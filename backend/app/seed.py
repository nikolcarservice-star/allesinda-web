import os
import random
import re
import sys
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

# Optional PIL import for creating placeholder images
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

from app.database import engine, Base, SessionLocal
from sqlalchemy import func
from app.models import (
    User, Role, Profile, Service, Product, Rental, Media, MediaStatus,
    Order, OrderType, OrderStatus, Review,
    AvailabilitySlot, Promotion, Favorite, Notification, Category, CategoryType,
    BlockedUser, FeaturedItem, ItemRelationship, RecentlyViewedItem
)
from app.security import get_password_hash
from app.config import settings
from app.utils.storage import get_upload_folder, get_media_subfolder, build_media_url
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models import City

def _load_city_coordinates_from_db(db: Session) -> dict[str, Tuple[float, float]]:
    """Load all German cities from DB into a name->(lat, lon) map."""
    coordinates: dict[str, Tuple[float, float]] = {}
    try:
        results = db.execute(
            select(City.name, City.latitude, City.longitude)
            .where(City.is_active == True)
        ).all()
        for name, lat, lon in results:
            if name and lat is not None and lon is not None:
                coordinates[str(name)] = (float(lat), float(lon))
    except Exception:
        # Table might not exist yet on first run; fall back to defaults below
        pass
    return coordinates

# Small built-in fallback set to keep seed usable if DB is empty
_CITY_COORDINATES_FALLBACK: dict[str, Tuple[float, float]] = {
	"Berlin": (52.5200, 13.4050),
	"Munich": (48.1351, 11.5820),
	"Hamburg": (53.5511, 9.9937),
	"Cologne": (50.9375, 6.9603),
	"Frankfurt": (50.1109, 8.6821),
	"Stuttgart": (48.7758, 9.1829),
	"Düsseldorf": (51.2277, 6.7735),
	"Dortmund": (51.5136, 7.4653),
	"Essen": (51.4556, 7.0116),
	"Leipzig": (51.3397, 12.3731),
	"Dresden": (51.0504, 13.7373),
	"Hannover": (52.3759, 9.7320),
	"Nuremberg": (49.4521, 11.0767),
	"Duisburg": (51.4344, 6.7623),
	"Bochum": (51.4818, 7.2162),
	"Wuppertal": (51.2562, 7.1508),
	"Bielefeld": (52.0302, 8.5325),
	"Mannheim": (49.4875, 8.4660),
	"Bonn": (50.7374, 7.0982),
	"Münster": (51.9607, 7.6261),
}

# Runtime-populated cache; prefer DB contents, fallback to small inline set
CITY_COORDINATES: dict[str, Tuple[float, float]] = {}

def refresh_city_coordinates_cache(db: Session) -> None:
    """Refresh CITY_COORDINATES from DB; use fallback if DB empty."""
    global CITY_COORDINATES
    coordinates = _load_city_coordinates_from_db(db)
    if coordinates:
        CITY_COORDINATES = coordinates
    else:
        CITY_COORDINATES = dict(_CITY_COORDINATES_FALLBACK)


def seed_german_cities(db: Session) -> int:
	"""Ensure German cities table is populated. Uses fallback set if empty."""
	created = 0
	try:
		existing_count = db.query(City).count()
	except Exception:
		# Table might not exist on first run; ensure metadata is created
		Base.metadata.create_all(bind=engine)
		existing_count = db.query(City).count()
	if existing_count > 0:
		return 0
	for name, (lat, lon) in _CITY_COORDINATES_FALLBACK.items():
		city = City(name=name, state=None, latitude=lat, longitude=lon, is_active=True)
		db.add(city)
		created += 1
	db.commit()
	return created

def _find_city_id(db: Session, name: Optional[str]) -> Optional[int]:
	"""Return city id by name (case-insensitive), None if not found or name missing."""
	if not name:
		return None
	try:
		row = db.execute(
			select(City.id).where(City.name.ilike(name))
		).first()
		if row:
			return row[0]
	except Exception:
		return None
	return None


def get_city_coordinates(city: Optional[str]) -> Tuple[Optional[float], Optional[float]]:
    """Return latitude/longitude tuple for the given city name."""
    if not city:
        return None, None
    coords = CITY_COORDINATES.get(city)
    if coords:
        return coords
    # Try normalized lookup by removing diacritics or alternate spellings
    normalized = city.replace("ü", "u").replace("ß", "ss")
    for key, value in CITY_COORDINATES.items():
        key_normalized = key.replace("ü", "u").replace("ß", "ss")
        if key_normalized.lower() == normalized.lower():
            return value
    return None, None

def create_placeholder_image(filename: str, width: int = 800, height: int = 600, color: tuple = (200, 200, 200), text: str = None, media_type: str = "photo", entity_type: Optional[str] = None) -> str:
    """Create a placeholder image file with text label and return its URL
    
    Uses structured format: {media_type}s/{YYYY}/{MM}/{filename}
    """
    if not PIL_AVAILABLE:
        # PIL not available, return structured URL
        now = datetime.now()
        subfolder = get_media_subfolder(media_type, now, entity_type=entity_type)
        return build_media_url(subfolder, filename)
    
    try:
        # Get upload folder
        upload_folder = get_upload_folder()
        
        # Create subfolder structure using the same format as uploaded images
        now = datetime.now()
        subfolder = get_media_subfolder(media_type, now, entity_type=entity_type)
        full_dir = os.path.join(upload_folder, subfolder)
        os.makedirs(full_dir, exist_ok=True)
        
        # Create placeholder image with gradient background
        img = Image.new('RGB', (width, height), color=color)
        
        # Add subtle gradient effect
        try:
            from PIL import ImageDraw
            draw = ImageDraw.Draw(img)
            # Create a subtle gradient from lighter to darker
            for y_pos in range(height):
                ratio = y_pos / height
                r = int(color[0] * (1 - ratio * 0.2))
                g = int(color[1] * (1 - ratio * 0.2))
                b = int(color[2] * (1 - ratio * 0.2))
                draw.line([(0, y_pos), (width, y_pos)], fill=(r, g, b))
        except:
            pass
        
        # Add text label if provided
        if text:
            try:
                from PIL import ImageDraw, ImageFont
                
                draw = ImageDraw.Draw(img)
                
                # Try to use a default font, fallback to basic if not available
                try:
                    # Try to use a system font
                    font_size = min(width, height) // 12
                    if font_size < 20:
                        font_size = 20
                    try:
                        font = ImageFont.truetype("arial.ttf", font_size)
                    except:
                        try:
                            font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", font_size)
                        except:
                            try:
                                # Try Linux font path
                                font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", font_size)
                            except:
                                font = ImageFont.load_default()
                except:
                    font = ImageFont.load_default()
                
                # Handle multiline text
                lines = text.split('\n')
                line_heights = []
                line_widths = []
                
                for line in lines:
                    bbox = draw.textbbox((0, 0), line, font=font)
                    line_heights.append(bbox[3] - bbox[1])
                    line_widths.append(bbox[2] - bbox[0])
                
                total_height = sum(line_heights) + (len(lines) - 1) * 10  # 10px spacing between lines
                max_width = max(line_widths) if line_widths else 0
                
                # Calculate text position (centered)
                x = (width - max_width) // 2
                y = (height - total_height) // 2
                
                # Draw semi-transparent background for text
                padding = 30
                overlay = Image.new('RGBA', (width, height), (0, 0, 0, 0))
                overlay_draw = ImageDraw.Draw(overlay)
                overlay_draw.rectangle(
                    [x - padding, y - padding, x + max_width + padding, y + total_height + padding],
                    fill=(0, 0, 0, 180)
                )
                img = Image.alpha_composite(img.convert('RGBA'), overlay).convert('RGB')
                draw = ImageDraw.Draw(img)
                
                # Draw each line of text
                current_y = y
                for i, line in enumerate(lines):
                    line_bbox = draw.textbbox((0, 0), line, font=font)
                    line_width = line_bbox[2] - line_bbox[0]
                    line_x = (width - line_width) // 2
                    draw.text((line_x, current_y), line, fill=(255, 255, 255), font=font)
                    current_y += line_heights[i] + 10
            except Exception as e:
                print(f"Warning: Could not add text to image: {e}")
        
        file_path = os.path.join(full_dir, filename)
        
        # Check if file already exists, skip creation if it does
        if os.path.exists(file_path):
            # Return URL using structured format without recreating the file
            return build_media_url(subfolder, filename)
        
        img.save(file_path, 'JPEG', quality=85)
        
        # Return URL using structured format
        return build_media_url(subfolder, filename)
    except Exception as e:
        print(f"Warning: Could not create placeholder image: {e}")
        # Fallback to structured format even on error
        now = datetime.now()
        subfolder = get_media_subfolder(media_type, now, entity_type=entity_type)
        return build_media_url(subfolder, filename)

def utcnow() -> datetime:
    """Return current UTC time with timezone awareness."""
    return datetime.now(timezone.utc)

def create_slug(name: str) -> str:
    """Create URL-friendly slug from name"""
    return name.lower().replace(" ", "-").replace("&", "and").replace("'", "").replace('"', "").replace(",", "").replace(".", "").replace("!", "").replace("?", "").replace("(", "").replace(")", "").replace("/", "-").replace("\\", "-")[:50]

# Track file counts per user for sequential numbering
_user_file_counts: dict[int, int] = {}

def generate_media_filename(user_id: int, file_ext: str, meaningful_name: Optional[str] = None, unique_suffix: Optional[str] = None) -> str:
    """Generate filename with user_id and sequential order number for files in year/month/ folders.
    
    Format: {user_id}_{order_number:06d}.{ext}
    Example: 5_000001.jpeg, 5_000002.jpeg
    
    Args:
        user_id: The user ID (seller_id for products/rentals, master.id for masters)
        file_ext: File extension (jpeg, mp4, etc.)
        meaningful_name: Optional meaningful name (not used in filename, kept for compatibility)
        unique_suffix: Optional unique suffix (not used, kept for compatibility)
    
    Returns:
        Filename string with sequential order number
    """
    # Initialize counter for this user if not exists
    if user_id not in _user_file_counts:
        _user_file_counts[user_id] = 0
    
    # Increment counter for this user
    _user_file_counts[user_id] += 1
    
    # Format: user_id_000001.ext (6-digit zero-padded order number)
    return f"{user_id}_{_user_file_counts[user_id]:06d}.{file_ext}"



def ensure_category_hero(category_slug: str, category_name: str, create_media_files: bool = False, category_type: Optional[str] = None, index: Optional[int] = None) -> str:
    """Create or reference a placeholder hero/header image for categories."""
    # Format for all category types: "{type}-{index:02d}.jpeg" (e.g., "master-01.jpeg", "product-01.jpeg", "rental-01.jpeg")
    # Examples: "master-01.jpeg", "product-01.jpeg", "rental-01.jpeg"
    if category_type in ("master", "product", "rental") and index is not None:
        filename = f"{category_type}-{index:02d}.jpeg"
    else:
        # Fallback: category_slug should be the full slug with type prefix (e.g., "product-power-tools", "master-security")
        filename = f"{category_slug}.jpeg"
    text_label = (category_name or category_slug.replace("-", " ").title())[:32]
    if create_media_files:
        return create_placeholder_image(filename, width=1600, height=900, text=text_label, media_type="photo", entity_type="category")

    now = datetime.now()
    subfolder = get_media_subfolder("photo", now, entity_type="category")
    return build_media_url(subfolder, filename)

# Hierarchical category structure for navigation
PRODUCT_CATEGORY_STRUCTURE = [
    {
        "name": "Elektrowerkzeuge",
        "description": "Elektrische und batteriebetriebene Werkzeuge für jedes Projekt.",
        "icon": "zap",
        "children": [
            {"name": "Bohrmaschinen", "description": "Akkubohrmaschinen und kabelgebundene Bohrmaschinen für alle Materialien."},
            {"name": "Sägen", "description": "Kreissägen, Stichsägen und Säbelsägen."},
            {"name": "Schleifmaschinen", "description": "Orbital-, Band- und Deltaschleifer."},
            {"name": "Schleifer", "description": "Winkelschleifer und Tischschleifer."},
            {"name": "Fräsen", "description": "Holzfräsen und Kantenprofilierwerkzeuge."},
            {"name": "Nagelpistolen", "description": "Pneumatische und akkubetriebene Nagler."},
            {"name": "Multifunktionswerkzeuge", "description": "Oszillierende Multifunktionswerkzeuge."},
            {"name": "Hobelmaschinen", "description": "Elektrische Hobelmaschinen für glatte Oberflächen."},
            {"name": "Heißluftgebläse", "description": "Heißluftwerkzeuge zum Ablösen und Formen."},
        ],
    },
    {
        "name": "Handwerkzeuge",
        "description": "Wesentliche Handwerkzeuge für präzise Arbeiten.",
        "icon": "wrench",
        "children": [
            {"name": "Schraubendreher", "description": "Phillips-, Schlitz- und Spezialschraubendreher."},
            {"name": "Schraubenschlüssel", "description": "Verstellbare, Kombinations- und Steckschlüsselsätze."},
            {"name": "Hämmer", "description": "Klauen-, Kugel- und Gummihämmer."},
            {"name": "Zangen", "description": "Spitz-, Schneid- und Klemmzangen."},
            {"name": "Schneidwerkzeuge", "description": "Draht-, Bolzen- und Kabel-Schneidwerkzeuge."},
            {"name": "Messwerkzeuge", "description": "Maßbänder, Lineale und Präzisionswinkel."},
            {"name": "Wasserwaagen", "description": "Libellen- und Laserwasserwaagen."},
            {"name": "Meißel", "description": "Holz- und Mauerwerkmeißel."},
            {"name": "Feilen", "description": "Metall- und Holzfeilen."},
            {"name": "Spannzangen", "description": "C-Spannzangen, Stabspannzangen und Federspannzangen."},
        ],
    },
    {
        "name": "Malerei",
        "description": "Alles für professionelle Malprojekte.",
        "icon": "paint-roller",
        "children": [
            {"name": "Pinsel", "description": "Synthetische und Naturborstenpinsel."},
            {"name": "Walzen", "description": "Walzenrahmen, -bezüge und -wannen."},
            {"name": "Spritzgeräte", "description": "HVLP- und luftlose Spritzsysteme."},
            {"name": "Klebeband", "description": "Abdeck- und Malerklebeband."},
            {"name": "Abdeckplanen", "description": "Leinwand- und Kunststoffschutzplanen."},
            {"name": "Schaber", "description": "Farbschaber und Spachtelmesser."},
            {"name": "Dichtungspistolen", "description": "Manuelle und motorisierte Dichtungsapplikatoren."},
            {"name": "Rührstäbe", "description": "Farbmischstäbe und elektrische Mischer."},
        ],
    },
    {
        "name": "Sanitär",
        "description": "Werkzeuge für Rohrleitungsarbeiten und Wassersysteme.",
        "icon": "pipe",
        "children": [
            {"name": "Rohrzangen", "description": "Rohrzangen und Beckenzangen."},
            {"name": "Rohrschneider", "description": "Rohr- und Schlauchschneider."},
            {"name": "Gewindeschneider", "description": "Rohrgewindeschneidwerkzeuge und Gewindebohrer."},
            {"name": "Rohrreinigungsspiralen", "description": "Manuelle und motorisierte Abflussreiniger."},
            {"name": "Presswerkzeuge", "description": "Pressverbindungssysteme."},
            {"name": "Rohrbieger", "description": "Rohrbiegewerkzeuge und -maschinen."},
            {"name": "Lötbrenner", "description": "Löt- und Lötbrenner."},
            {"name": "Inspektion", "description": "Rohrinspektionskameras."},
            {"name": "Dichtungsmittel", "description": "Rohrgewindedichtmittel und Teflonband."},
        ],
    },
    {
        "name": "Sicherheit",
        "description": "Schutzausrüstung für sicheres Arbeiten.",
        "icon": "shield-check",
        "children": [
            {"name": "Helme", "description": "Schutzhelme und Sicherheitshelme."},
            {"name": "Brillen", "description": "Sicherheitsbrillen und Schutzbrillen."},
            {"name": "Gehörschutz", "description": "Ohrenstöpsel und Gehörschutzstöpsel."},
            {"name": "Masken", "description": "Staubmasken und Atemschutzmasken."},
            {"name": "Handschuhe", "description": "Arbeitsschutzhandschuhe für verschiedene Gefahren."},
            {"name": "Stiefel", "description": "Stahlkappen- und Sicherheitsstiefel."},
            {"name": "Warnwesten", "description": "Warnwesten mit hoher Sichtbarkeit."},
            {"name": "Knieschützer", "description": "Schützende Knieschoner."},
            {"name": "Erste Hilfe", "description": "Erste-Hilfe-Kästen und -materialien."},
            {"name": "Feuerlöscher", "description": "Tragbare Feuerlöscher."},
        ],
    },
    {
        "name": "Aufbewahrung",
        "description": "Organisieren und schützen Sie Ihre Werkzeuge.",
        "icon": "boxes",
        "children": [
            {"name": "Werkzeugkästen", "description": "Tragbare und rollende Werkzeugkästen."},
            {"name": "Schränke", "description": "Werkzeugaufbewahrungsschränke."},
            {"name": "Taschen", "description": "Werkzeugtaschen und Rucksäcke."},
            {"name": "Regale", "description": "Wandmontierte und freistehende Regale."},
            {"name": "Lochplatten", "description": "Lochplattensysteme und Haken."},
            {"name": "Organisatoren", "description": "Schubladenorganisatoren und Schaumeinsätze."},
            {"name": "Wagen", "description": "Mobile Werkzeugwagen."},
            {"name": "Behälter", "description": "Aufbewahrungsboxen und Behälter."},
        ],
    },
    {
        "name": "Elektrik",
        "description": "Elektrowerkzeuge und -zubehör.",
        "icon": "plug",
        "children": [
            {"name": "Tester", "description": "Spannungstester und Multimeter."},
            {"name": "Abisolierzangen", "description": "Drahtabisolierwerkzeuge."},
            {"name": "Crimpzangen", "description": "Drahtcrimpwerkzeuge."},
            {"name": "Kabelkanäle", "description": "Elektrische Kabelkanäle und Fittings."},
            {"name": "Sicherungen", "description": "Leitungsschutzschalter und Verteiler."},
            {"name": "Steckdosen", "description": "Elektrische Steckdosen und Schalter."},
            {"name": "Kabel", "description": "Elektrische Drähte und Kabel."},
            {"name": "Verbindungen", "description": "Kabelverbinder und Stecker."},
            {"name": "Klebeband", "description": "Elektroklebeband und Etiketten."},
        ],
    },
    {
        "name": "HLK",
        "description": "Werkzeuge für Heizungs- und Kühlsysteme.",
        "icon": "thermometer",
        "children": [
            {"name": "Manometer", "description": "Kältemittelsammelschienen-Manometer."},
            {"name": "Vakuumpumpen", "description": "Klimaanlagen-Vakuumpumpen."},
            {"name": "Leckdetektoren", "description": "Kältemittelleck-Erkennungswerkzeuge."},
            {"name": "Kanalwerkzeuge", "description": "Kanal-Schneid- und -Dichtungswerkzeuge."},
            {"name": "Thermometer", "description": "Digitale und Infrarot-Thermometer."},
            {"name": "Filter", "description": "HLK-Luftfilter."},
            {"name": "Kanalsysteme", "description": "Kanalmaterialien und Fittings."},
            {"name": "Isolierung", "description": "Kanalisolierung und -ummantelungen."},
        ],
    },
    {
        "name": "Reinigung",
        "description": "Professionelle Reinigungsausrüstung.",
        "icon": "broom",
        "children": [
            {"name": "Hochdruckreiniger", "description": "Elektrische und gasbetriebene Hochdruckreiniger."},
            {"name": "Staubsauger", "description": "Nass-Trocken-Staubsauger und Werkstattstaubsauger."},
            {"name": "Besen", "description": "Kehrbesen und Kehrschaufeln."},
            {"name": "Mopps", "description": "Moppeimer und Wringvorrichtungen."},
            {"name": "Bürsten", "description": "Scheuerbürsten und Reinigungsbürsten."},
            {"name": "Schwämme", "description": "Reinigungsschwämme und -pads."},
            {"name": "Chemikalien", "description": "Reinigungsmittel und Waschmittel."},
            {"name": "Tücher", "description": "Mikrofaser- und Reinigungstücher."},
            {"name": "Eimer", "description": "Reinigungseimer und Behälter."},
        ],
    },
    {
        "name": "Garten",
        "description": "Werkzeuge für Außen- und Gartenwartung.",
        "icon": "leaf",
        "children": [
            {"name": "Rasenmäher", "description": "Rasenmäher und Trimmer."},
            {"name": "Gartenscheren", "description": "Handgartenscheren und Astscheren."},
            {"name": "Schaufeln", "description": "Grabeschaufeln und Spaten."},
            {"name": "Rechen", "description": "Laubrechen und Gartenrechen."},
            {"name": "Schläuche", "description": "Gartenschläuche und Düsen."},
            {"name": "Sprinkler", "description": "Rasensprinkler und Bewässerung."},
            {"name": "Schubkarren", "description": "Gartenkarren und Schubkarren."},
            {"name": "Scheren", "description": "Heckenscheren und Grasscheren."},
        ],
    },
]

RENTAL_CATEGORY_STRUCTURE = [
    {
        "name": "Bagger",
        "description": "Schwere Maschinen zum Graben und Erdbewegen.",
        "icon": "mountain",
        "children": [
            {"name": "Mini", "description": "Kompakte Maschinen für enge Räume."},
            {"name": "Mittelklasse", "description": "Mittlere Maschinen für allgemeine Arbeiten."},
            {"name": "Groß", "description": "Schwerlastmaschinen für große Projekte."},
            {"name": "Räder", "description": "Rädermaschinen für Mobilität."},
            {"name": "Raupen", "description": "Raupenmaschinen für Stabilität."},
            {"name": "Langausleger", "description": "Maschinen mit erweitertem Ausleger."},
            {"name": "Nullschwanz", "description": "Maschinen ohne Schwanzschwingung."},
            {"name": "Anbaugeräte", "description": "Löffel, Brecher und Greifer."},
        ],
    },
    {
        "name": "Bühnen",
        "description": "Zugangsausrüstung für Arbeiten in der Höhe.",
        "icon": "arrow-up",
        "children": [
            {"name": "Scherenbühnen", "description": "Elektrische und dieselbetriebene Scherenplattformen."},
            {"name": "Teleskopbühnen", "description": "Gelenk- und Teleskopausleger."},
            {"name": "Mastbühnen", "description": "Kompakte Personenbühnen."},
            {"name": "Spider-Bühnen", "description": "Raupen-Zugangsplattformen."},
            {"name": "Arbeitsbühnen", "description": "Mobile erhöhte Arbeitsplattformen."},
            {"name": "Gerüste", "description": "Modulare Gerüstsysteme."},
            {"name": "Leitern", "description": "Industrielle Leitern und Zugangssysteme."},
        ],
    },
    {
        "name": "Gabelstapler",
        "description": "Materialhandhabungs- und Hebeausrüstung.",
        "icon": "dolly",
        "children": [
            {"name": "Elektro", "description": "Batteriebetriebene Gabelstapler."},
            {"name": "Diesel", "description": "Dieselbetriebene Gabelstapler."},
            {"name": "Schubmaststapler", "description": "Schmalgang-Gabelstapler."},
            {"name": "Hubwagen", "description": "Manuelle und elektrische Hubwagen."},
            {"name": "Stapler", "description": "Manuelle und elektrische Stapler."},
            {"name": "Teleskoplader", "description": "Teleskop-Handler."},
            {"name": "Kommissioniergeräte", "description": "Lager-Kommissionierausrüstung."},
        ],
    },
    {
        "name": "Beton",
        "description": "Betonmisch-, -pump- und -veredelungsausrüstung.",
        "icon": "cube",
        "children": [
            {"name": "Mischer", "description": "Anhänger- und tragbare Mischer."},
            {"name": "Pumpen", "description": "Betonpumpen und -ausleger."},
            {"name": "Glättmaschinen", "description": "Handgeführte und fahrbare Glättmaschinen."},
            {"name": "Schleifer", "description": "Beton-Schleif- und -Poliermaschinen."},
            {"name": "Sägen", "description": "Beton-Schneidsägen."},
            {"name": "Rüttler", "description": "Betonrüttler."},
            {"name": "Schalungen", "description": "Betonformen und Abstützungen."},
        ],
    },
    {
        "name": "Generatoren",
        "description": "Stromerzeugungs- und -verteilungsausrüstung.",
        "icon": "lightbulb",
        "children": [
            {"name": "Diesel", "description": "Dieselgeneratoren."},
            {"name": "Gas", "description": "Gasbetriebene Generatoren."},
            {"name": "Solar", "description": "Solargeneratoren und -panels."},
            {"name": "Batterie", "description": "Batterie-Backup-Systeme."},
            {"name": "Beleuchtung", "description": "Lichtmasten und Arbeitsleuchten."},
            {"name": "Verteilung", "description": "Stromverteilungsausrüstung."},
        ],
    },
    {
        "name": "Klimatisierung",
        "description": "Heizung, Kühlung und Luftmanagement.",
        "icon": "thermometer",
        "children": [
            {"name": "Klimaanlagen", "description": "Tragbare Klimaanlagen."},
            {"name": "Heizgeräte", "description": "Tragbare Heizgeräte."},
            {"name": "Ventilatoren", "description": "Industrielle Ventilatoren und Gebläse."},
            {"name": "Entfeuchter", "description": "Feuchtigkeitsentfernungssysteme."},
            {"name": "Luftreiniger", "description": "Luftreinigungssysteme."},
            {"name": "Lüftung", "description": "Lüftungsausrüstung."},
        ],
    },
    {
        "name": "Baustelleneinrichtungen",
        "description": "Temporäre Gebäude und Baustellenausstattung.",
        "icon": "home",
        "children": [
            {"name": "Büros", "description": "Baustellenbüros und Besprechungsräume."},
            {"name": "Toiletten", "description": "Tragbare Toiletten und Duschen."},
            {"name": "Container", "description": "Lagercontainer."},
            {"name": "Zäune", "description": "Baustellenzäune und Barrieren."},
            {"name": "Abfall", "description": "Abfallbehälter und Verdichter."},
            {"name": "Sozialeinrichtungen", "description": "Sozialeinrichtungen und Anlagen."},
        ],
    },
    {
        "name": "Vermessungsausrüstung",
        "description": "Vermessungs- und Messinstrumente.",
        "icon": "compass",
        "children": [
            {"name": "Tachymeter", "description": "Vermessungstachymeter."},
            {"name": "GPS", "description": "GPS- und GNSS-Ausrüstung."},
            {"name": "Nivelliere", "description": "Vermessungsnivelliere."},
            {"name": "Laser", "description": "Laserwasserwaagen und Scanner."},
            {"name": "Drohnen", "description": "Vermessungsdrohnen."},
            {"name": "Messgeräte", "description": "Entfernungsmessgeräte."},
        ],
    },
    {
        "name": "Lkw",
        "description": "Schwere Transport- und Nutzfahrzeuge.",
        "icon": "truck",
        "children": [
            {"name": "Kipper", "description": "Kipper für Materialtransport."},
            {"name": "Pritschenwagen", "description": "Pritschenwagen."},
            {"name": "Wassertankwagen", "description": "Wassertankwagen."},
            {"name": "Tankwagen", "description": "Kraftstofflieferwagen."},
            {"name": "Kranwagen", "description": "Lkw-Montagekrane."},
            {"name": "Anhänger", "description": "Nutz- und Geräteanhänger."},
        ],
    },
    {
        "name": "Verdichter",
        "description": "Boden- und Asphaltverdichtungsausrüstung.",
        "icon": "mountain",
        "children": [
            {"name": "Platte", "description": "Vibrationsplattenverdichter."},
            {"name": "Walzen", "description": "Glatt- und Stachelwalzen."},
            {"name": "Rammgerät", "description": "Rammgeräte."},
            {"name": "Stampfer", "description": "Handstampfer und Verdichter."},
            {"name": "Vibrations", "description": "Vibrationsverdichtungsausrüstung."},
            {"name": "Handgeführte", "description": "Handgeführte Verdichter."},
            {"name": "Fahrbare", "description": "Fahrbare Verdichtungsmaschinen."},
        ],
    },
]

MASTER_CATEGORY_STRUCTURE = [
    {
        "name": "Auto",
        "description": "Professionelle Autoservices und Reparaturen.",
        "icon": "car",
        "children": [
            {"name": "Reparaturen", "description": "Allgemeine Autoreparatur und Wartung."},
            {"name": "Motor", "description": "Motordiagnose und Reparatur."},
            {"name": "Bremsen", "description": "Bremsbelag- und Scheibenwechsel."},
            {"name": "Reifen", "description": "Reifenwechsel und Auswuchtung."},
            {"name": "Ölwechsel", "description": "Öl- und Filterwechsel-Service."},
            {"name": "Batterie", "description": "Autobatteriewechsel und -prüfung."},
            {"name": "Klimaservice", "description": "Klimaanlagenreparatur und -auffüllung."},
            {"name": "Elektrik", "description": "Auto-Elektrikreparaturen."},
            {"name": "Karosserie", "description": "Dellenentfernung und Karosseriereparaturen."},
            {"name": "Lackierung", "description": "Autolackierung und Aufbereitung."},
            {"name": "Aufbereitung", "description": "Innen- und Außenaufbereitung von Autos."},
            {"name": "Inspektion", "description": "Fahrzeuginspektion und Diagnose."},
        ],
    },
    {
        "name": "Sanitär",
        "description": "Fachkundige Klempner für alle Ihre Wasser- und Rohrleitungsbedürfnisse.",
        "icon": "droplet",
        "children": [
            {"name": "Reparaturen", "description": "Behebung von Lecks, Verstopfungen und defekten Armaturen."},
            {"name": "Installation", "description": "Neue Armaturen und Rohrleitungsinstallation."},
            {"name": "Abflussreinigung", "description": "Entstopfung von Abflüssen und Kanälen."},
            {"name": "Leckerkennung", "description": "Auffinden und Behebung versteckter Lecks."},
            {"name": "Warmwasserbereiter", "description": "Installation und Reparatur von Warmwasserbereitern."},
            {"name": "Notfall", "description": "24/7 dringende Klempnerservices."},
            {"name": "Armaturen", "description": "Installation von Wasserhähnen, Waschbecken und Toiletten."},
            {"name": "Inspektion", "description": "Kamera-Rohrinspektion."},
            {"name": "Rohrzangen", "description": "Rohrzangen und Beckenzangen."},
        ],
    },
    {
        "name": "Elektrik",
        "description": "Lizenzierte Elektriker für sichere Elektroarbeiten.",
        "icon": "zap",
        "children": [
            {"name": "Reparaturen", "description": "Behebung elektrischer Fehler und Probleme."},
            {"name": "Installation", "description": "Neue Verkabelung und Steckdosen."},
            {"name": "Beleuchtung", "description": "Installation und Upgrade von Beleuchtung."},
            {"name": "Smart Home", "description": "Hausautomatisierungseinrichtung."},
            {"name": "Solar", "description": "Solarpanel-Installation."},
            {"name": "Neuverkabelung", "description": "Komplette elektrische Neuverkabelung."},
            {"name": "E-Auto-Ladestationen", "description": "Elektrofahrzeug-Ladestationsinstallation."},
            {"name": "Verteiler", "description": "Elektroverteiler-Upgrades."},
            {"name": "Prüfung", "description": "Sicherheitsprüfung und Zertifizierung."},
        ],
    },
    {
        "name": "Reinigung",
        "description": "Professionelle Reinigungsservices für Wohnungen und Büros.",
        "icon": "sparkles",
        "children": [
            {"name": "Regelmäßig", "description": "Wöchentliche oder monatliche Reinigung."},
            {"name": "Grundreinigung", "description": "Gründlicher Grundreinigungsservice."},
            {"name": "Teppich", "description": "Teppich- und Läuferreinigung."},
            {"name": "Fenster", "description": "Innen- und Außenfensterreinigung."},
            {"name": "Auszug", "description": "Endreinigung bei Auszug."},
            {"name": "Büro", "description": "Gewerbliche Büroreinigung."},
            {"name": "Hochdruckreinigung", "description": "Außen-Hochdruckreinigung."},
            {"name": "Desinfektion", "description": "Sanitisierungsservices."},
        ],
    },
    {
        "name": "Sicherheit",
        "description": "Schützen Sie Ihr Zuhause und Geschäft mit Sicherheitsexperten.",
        "icon": "lock",
        "children": [
            {"name": "Schlosserei", "description": "Schlossinstallation und -reparatur."},
            {"name": "Alarmanlagen", "description": "Sicherheitsalarm-Installation."},
            {"name": "Kameras", "description": "Überwachungskamera-Installation."},
            {"name": "Smart Locks", "description": "Smart-Lock-Installation."},
            {"name": "Zugangskontrolle", "description": "Zugangskontrollsysteme."},
            {"name": "Schlüssel", "description": "Schlüsselherstellung und Duplikation."},
            {"name": "Tresore", "description": "Tresor-Installation und -Öffnung."},
            {"name": "Notfall", "description": "24/7 Aussperrungsservice."},
        ],
    },
    {
        "name": "Dachdecker",
        "description": "Fachkundige Dachdecker für Reparaturen und Installationen.",
        "icon": "home",
        "children": [
            {"name": "Reparaturen", "description": "Behebung von Lecks und beschädigtem Dach."},
            {"name": "Ersatz", "description": "Kompletter Dachersatz."},
            {"name": "Regenrinnen", "description": "Regenrinne-Installation und -Reinigung."},
            {"name": "Abdichtung", "description": "Dachabdichtung."},
            {"name": "Inspektionen", "description": "Dachzustandsinspektionen."},
            {"name": "Sturmschäden", "description": "Notfall-Sturmreparaturen."},
            {"name": "Dachfenster", "description": "Dachfenster-Installation."},
        ],
    },
    {
        "name": "Schreinerei",
        "description": "Geschickte Schreiner für individuelle Holzarbeiten.",
        "icon": "saw",
        "children": [
            {"name": "Möbel", "description": "Individuelle Möbelherstellung."},
            {"name": "Schränke", "description": "Küchen- und Badezimmerschränke."},
            {"name": "Terrassen", "description": "Terrassenbau und -reparatur."},
            {"name": "Türen", "description": "Türinstallation und -reparatur."},
            {"name": "Fenster", "description": "Fensterinstallation."},
            {"name": "Gerüst", "description": "Strukturelle Gerüstarbeiten."},
            {"name": "Verkleidung", "description": "Sockelleisten und Kronleisten."},
            {"name": "Regale", "description": "Individuelle Regal-Installation."},
            {"name": "Treppen", "description": "Treppenbau."},
        ],
    },
    {
        "name": "Fliesen",
        "description": "Professionelle Fliesenleger für Böden und Wände.",
        "icon": "grid",
        "children": [
            {"name": "Boden", "description": "Bodenfliesen-Installation."},
            {"name": "Wand", "description": "Wandfliesen-Installation."},
            {"name": "Badezimmer", "description": "Komplette Badezimmer-Fliesen."},
            {"name": "Küche", "description": "Küchen-Rückwand und Boden."},
            {"name": "Abdichtung", "description": "Nassbereich-Abdichtung."},
            {"name": "Reparatur", "description": "Fliesenreparatur und -ersatz."},
            {"name": "Fugen", "description": "Fugenreinigung und -versiegelung."},
            {"name": "Fußbodenheizung", "description": "Fußbodenheizungs-Installation."},
        ],
    },
    {
        "name": "Malerei",
        "description": "Professionelle Maler für Innen- und Außenarbeiten.",
        "icon": "brush",
        "children": [
            {"name": "Innen", "description": "Innenraum-Hausmalerei."},
            {"name": "Außen", "description": "Außen-Hausmalerei."},
            {"name": "Dekorativ", "description": "Akzentwände und spezielle Oberflächen."},
            {"name": "Spritzlackierung", "description": "Spritzlackier-Services."},
            {"name": "Schränke", "description": "Schrank-Aufbereitung."},
            {"name": "Tapeten", "description": "Tapeten-Installation."},
            {"name": "Terrasse", "description": "Terrassenversiegelung und -abdichtung."},
            {"name": "Gewerblich", "description": "Gewerbliche Malerei."},
        ],
    },
    {
        "name": "HLK",
        "description": "Experten für Heizungs- und Kühlsysteme.",
        "icon": "wind",
        "children": [
            {"name": "Installation", "description": "Neue Klimaanlagen- und Heizungsinstallation."},
            {"name": "Reparatur", "description": "Klimaanlagen- und Heizungsreparaturen."},
            {"name": "Wartung", "description": "Regelmäßiger Service und Wartung."},
            {"name": "Kanalreinigung", "description": "Kanalreinigungsservices."},
            {"name": "Thermostate", "description": "Smart-Thermostat-Installation."},
            {"name": "Wärmepumpen", "description": "Wärmepumpen-Installation."},
            {"name": "Lüftung", "description": "Lüftungssystem-Installation."},
        ],
    },
    {
        "name": "Handwerker",
        "description": "Vielseitige Fachkräfte für verschiedene Hausreparaturen.",
        "icon": "wrench",
        "children": [
            {"name": "Montage", "description": "Möbel- und Gerätemontage."},
            {"name": "Befestigung", "description": "TV- und Regalbefestigung."},
            {"name": "Reparaturen", "description": "Allgemeine Hausreparaturen."},
            {"name": "Installation", "description": "Armaturen- und Geräteinstallation."},
            {"name": "Wartung", "description": "Hauswartungsaufgaben."},
            {"name": "Kleine Arbeiten", "description": "Schnellreparatur-Services."},
        ],
    },
]

CATEGORY_HIERARCHY = {
    CategoryType.product: PRODUCT_CATEGORY_STRUCTURE,
    CategoryType.rental: RENTAL_CATEGORY_STRUCTURE,
    CategoryType.master: MASTER_CATEGORY_STRUCTURE,
}

def ensure_min_subcategories(structure, min_children: int = 6) -> None:
    """Ensure every category group contains at least the specified number of unique subcategories."""
    for group in structure:
        children = group.setdefault("children", [])

        # Deduplicate existing children by case-insensitive name to avoid runaway growth across runs
        unique_children: dict[str, dict] = {}
        for child in children:
            name_key = child.get("name", "").strip().lower()
            if not name_key:
                continue
            if name_key not in unique_children:
                unique_children[name_key] = child
        children[:] = list(unique_children.values())

        # Don't add extra subcategories - use only what's provided in the structure
        # Subcategory names should never be modified
        if len(children) < min_children:
            print(f"  ⚠ Warning: Category '{group['name']}' has only {len(children)} subcategories (minimum {min_children} recommended)")


def ensure_min_categories(structure, min_categories: int = 10) -> None:
    """Ensure there are at least the specified number of main categories."""
    if len(structure) < min_categories:
        raise ValueError(f"Category structure must have at least {min_categories} categories, but found {len(structure)}")

# Validate minimum categories
ensure_min_categories(PRODUCT_CATEGORY_STRUCTURE, min_categories=10)
ensure_min_categories(RENTAL_CATEGORY_STRUCTURE, min_categories=10)
ensure_min_categories(MASTER_CATEGORY_STRUCTURE, min_categories=10)

# Ensure minimum subcategories per category
ensure_min_subcategories(PRODUCT_CATEGORY_STRUCTURE)
ensure_min_subcategories(RENTAL_CATEGORY_STRUCTURE)
ensure_min_subcategories(MASTER_CATEGORY_STRUCTURE)


def ensure_featured_selections(db, master_users, products, rentals):
    """Create curated featured selections for homepage and header highlights."""
    print("\nCreating featured selections...")

    existing_count = db.query(FeaturedItem).count()
    if existing_count:
        print("  ↺ Featured selections already exist (skipping)")
        return

    entries_created = 0
    base_priority = 100

    def add_selection(item_type: CategoryType, item_id: int, offset: int):
        nonlocal entries_created
        featured = FeaturedItem(
            item_type=item_type,
            item_id=item_id,
            priority=base_priority - offset,
            is_active=True,
        )
        db.add(featured)
        entries_created += 1

    for index, (_, profile) in enumerate(master_users[:3]):
        if profile:
            add_selection(CategoryType.master, profile.id, index * 5)

    for index, product in enumerate(products[:3]):
        add_selection(CategoryType.product, product.id, 20 + index * 5)

    for index, rental in enumerate(rentals[:3]):
        add_selection(CategoryType.rental, rental.id, 40 + index * 5)

    if entries_created:
        db.commit()
        print(f"  ✓ Created {entries_created} featured selection(s)")
    else:
        print("  ! No items available for featured selections")


def seed_item_relationships(db, master_users, products, rentals, created_by: int | None = None) -> None:
    """Create cross-entity relationships to power featured showcases and recommendations."""
    print("\nLinking related items...")

    if db.query(ItemRelationship).count():
        print("  ↺ Item relationships already exist (skipping)")
        return

    if not master_users and not products and not rentals:
        print("  ! No items available to relate")
        return

    created = 0

    def add_relationship(source_type: CategoryType, source_id: int, target_type: CategoryType, target_id: int) -> None:
        nonlocal created
        exists = (
            db.query(ItemRelationship)
            .filter(
                ItemRelationship.source_type == source_type,
                ItemRelationship.source_id == source_id,
                ItemRelationship.target_type == target_type,
                ItemRelationship.target_id == target_id,
            )
            .first()
        )
        if exists:
            return
        relationship = ItemRelationship(
            source_type=source_type,
            source_id=source_id,
            target_type=target_type,
            target_id=target_id,
            created_by=created_by,
        )
        db.add(relationship)
        created += 1

    top_masters = [profile for _, profile in master_users[:6] if profile]
    top_products = products[:6]
    top_rentals = rentals[:6]

    for index, profile in enumerate(top_masters):
        if top_products:
            product = top_products[index % len(top_products)]
            add_relationship(CategoryType.master, profile.id, CategoryType.product, product.id)
        if top_rentals:
            rental = top_rentals[index % len(top_rentals)]
            add_relationship(CategoryType.master, profile.id, CategoryType.rental, rental.id)

    for index, product in enumerate(top_products):
        if top_rentals:
            rental = top_rentals[index % len(top_rentals)]
            add_relationship(CategoryType.product, product.id, CategoryType.rental, rental.id)

    if created:
        db.commit()
        print(f"  ✓ Created {created} item relationship(s)")
    else:
        print("  ! No new item relationships were created")


def seed_recently_viewed_items(db, client_users, master_users, products, rentals) -> None:
    """Seed recently viewed activity so the carousel has meaningful content."""
    print("\nRecording sample recently viewed items...")

    if db.query(RecentlyViewedItem).count():
        print("  ↺ Recently viewed items already exist (skipping)")
        return

    if not client_users:
        print("  ! No clients available to assign recently viewed items")
        return

    viewed_created = 0

    selections = []
    master_profiles = [profile for _, profile in master_users]
    selections.extend([(CategoryType.master, profile.id) for profile in master_profiles[:5]])
    selections.extend([(CategoryType.product, product.id) for product in products[:5]])
    selections.extend([(CategoryType.rental, rental.id) for rental in rentals[:5]])

    if not selections:
        print("  ! No items available for recently viewed records")
        return

    for client_index, client in enumerate(client_users):
        # Each client gets up to 5 recently viewed items staggered in time
        for offset, (item_type, item_id) in enumerate(selections[:5]):
            record = RecentlyViewedItem(
                user_id=client.id,
                item_type=item_type,
                item_id=item_id,
                viewed_at=utcnow() - timedelta(hours=(client_index * 3 + offset)),
            )
            db.add(record)
            viewed_created += 1

    db.commit()
    print(f"  ✓ Created {viewed_created} recently viewed item(s)")


# ============================================
# CONSTANT DATA ARRAYS
# ============================================

# Predefined masters data (8 masters)
# Each master must have: name, email, category (main category name), subcategory (subcategory name), city (city name)
MASTERS_DATA = [
    {"name": "Thomas Schmidt", "email": "thomas.schmidt@example.com", "category": "Sicherheit", "subcategory": "Schlosserei", "city": "Berlin"},
    {"name": "Anna Müller", "email": "anna.mueller@example.com", "category": "Malerei", "subcategory": "Tapeten", "city": "Munich"},
    {"name": "Maria Schneider", "email": "maria.schneider@example.com", "category": "Reinigung", "subcategory": "Grundreinigung", "city": "Hamburg"},
    {"name": "Michael Fischer", "email": "michael.fischer@example.com", "category": "Sanitär", "subcategory": "Reparaturen", "city": "Cologne"},
    {"name": "Andreas Richter", "email": "andreas.richter@example.com", "category": "Dachdecker", "subcategory": "Dachfenster", "city": "Frankfurt"},
    {"name": "Stefan Wagner", "email": "stefan.wagner@example.com", "category": "Schreinerei", "subcategory": "Möbel", "city": "Stuttgart"},
    {"name": "Petra Becker", "email": "petra.becker@example.com", "category": "Fliesen", "subcategory": "Abdichtung", "city": "Düsseldorf"},
    {"name": "Sabine Hoffmann", "email": "sabine.hoffmann@example.com", "category": "Malerei", "subcategory": "Gewerblich", "city": "Dortmund"},
    {"name": "Klaus Weber", "email": "klaus.weber@example.com", "category": "Auto", "subcategory": "Reparaturen", "city": "Berlin"},
    {"name": "Hans Bauer", "email": "hans.bauer@example.com", "category": "Auto", "subcategory": "Motor", "city": "Munich"},
    {"name": "Peter Koch", "email": "peter.koch@example.com", "category": "Auto", "subcategory": "Bremsen", "city": "Hamburg"},
]

# Predefined products data (23 products)
# Each product must have: title, category (main category name), subcategory (subcategory name), price, brand (optional), stock, city (city name)
PRODUCTS_DATA = [
    {"title": "Bosch GSR 12V-15 18V Bohrmaschinen", "category": "Elektrowerkzeuge", "subcategory": "Bohrmaschinen", "price": 89.99, "brand": "Bosch", "stock": 15, "city": "Berlin"},
    {"title": "DeWalt DCD791D2 10-teiliges Schraubendreher-Set", "category": "Handwerkzeuge", "subcategory": "Schraubendreher", "price": 24.99, "brand": "DeWalt", "stock": 30, "city": "Munich"},
    {"title": "Purdy XL Elite 4\" Synthetische Pinsel", "category": "Malerei", "subcategory": "Pinsel", "price": 12.50, "brand": "Purdy", "stock": 50, "city": "Hamburg"},
    {"title": "Milwaukee M18 20V Sägen", "category": "Elektrowerkzeuge", "subcategory": "Sägen", "price": 149.99, "brand": "Milwaukee", "stock": 12, "city": "Cologne"},
    {"title": "Stanley FatMax 8-teiliges Schraubenschlüssel-Set", "category": "Handwerkzeuge", "subcategory": "Schraubenschlüssel", "price": 35.99, "brand": "Stanley", "stock": 25, "city": "Frankfurt"},
    {"title": "Festool RO 150 18V Schleifmaschinen", "category": "Elektrowerkzeuge", "subcategory": "Schleifmaschinen", "price": 299.99, "brand": "Festool", "stock": 8, "city": "Stuttgart"},
    {"title": "Makita GA7020 240V Schleifer", "category": "Elektrowerkzeuge", "subcategory": "Schleifer", "price": 129.99, "brand": "Makita", "stock": 18, "city": "Düsseldorf"},
    {"title": "Bosch GKF 600 20V Fräsen", "category": "Elektrowerkzeuge", "subcategory": "Fräsen", "price": 179.99, "brand": "Bosch", "stock": 10, "city": "Dortmund"},
    {"title": "DeWalt DCN692 20V Nagelpistolen", "category": "Elektrowerkzeuge", "subcategory": "Nagelpistolen", "price": 249.99, "brand": "DeWalt", "stock": 6, "city": "Essen"},
    {"title": "Hilti TE 6-A22 36V Multifunktionswerkzeuge", "category": "Elektrowerkzeuge", "subcategory": "Multifunktionswerkzeuge", "price": 399.99, "brand": "Hilti", "stock": 5, "city": "Leipzig"},
    {"title": "Metabo HO 0882 20V Hobelmaschinen", "category": "Elektrowerkzeuge", "subcategory": "Hobelmaschinen", "price": 159.99, "brand": "Metabo", "stock": 9, "city": "Dresden"},
    {"title": "Bosch GHG 660 2000W Heißluftgebläse", "category": "Elektrowerkzeuge", "subcategory": "Heißluftgebläse", "price": 79.99, "brand": "Bosch", "stock": 20, "city": "Hannover"},
    {"title": "Wera Kraftform Plus 12-teiliges Zangen-Set", "category": "Handwerkzeuge", "subcategory": "Zangen", "price": 45.99, "brand": "Wera", "stock": 22, "city": "Nuremberg"},
    {"title": "Estwing E3-20C 20oz Hämmer", "category": "Handwerkzeuge", "subcategory": "Hämmer", "price": 28.99, "brand": "Estwing", "stock": 35, "city": "Duisburg"},
    {"title": "Knipex 10 32 10-teiliges Zangen-Set", "category": "Handwerkzeuge", "subcategory": "Schneidwerkzeuge", "price": 52.99, "brand": "Knipex", "stock": 15, "city": "Bochum"},
    {"title": "Stanley 33-425 6\" Messwerkzeuge", "category": "Handwerkzeuge", "subcategory": "Messwerkzeuge", "price": 15.99, "brand": "Stanley", "stock": 40, "city": "Wuppertal"},
    {"title": "Stabila 19648 48\" Wasserwaagen", "category": "Handwerkzeuge", "subcategory": "Wasserwaagen", "price": 42.99, "brand": "Stabila", "stock": 28, "city": "Bielefeld"},
    {"title": "Narex 6-teiliges Meißel-Set", "category": "Handwerkzeuge", "subcategory": "Meißel", "price": 38.99, "brand": "Narex", "stock": 18, "city": "Bonn"},
    {"title": "Bahco 6-teiliges Feilen-Set", "category": "Handwerkzeuge", "subcategory": "Feilen", "price": 32.99, "brand": "Bahco", "stock": 25, "city": "Münster"},
    {"title": "Bessey GSCC2.525 4-teiliges Spannzangen-Set", "category": "Handwerkzeuge", "subcategory": "Spannzangen", "price": 48.99, "brand": "Bessey", "stock": 20, "city": "Karlsruhe"},
    {"title": "Wooster Pro 9\" Schaumwalzen", "category": "Malerei", "subcategory": "Walzen", "price": 18.99, "brand": "Wooster", "stock": 30, "city": "Mannheim"},
    {"title": "Graco Magnum X5 240V Spritzgeräte", "category": "Malerei", "subcategory": "Spritzgeräte", "price": 349.99, "brand": "Graco", "stock": 7, "city": "Augsburg"},
    {"title": "3M 2080 2\" Klebeband", "category": "Malerei", "subcategory": "Klebeband", "price": 8.99, "brand": "3M", "stock": 60, "city": "Wiesbaden"},
]

# Predefined rentals data (7 rentals)
# Each rental must have: title, category (main category name), subcategory (subcategory name), price_per_day, stock, city (city name)
RENTALS_DATA = [
    {"title": "CAT 320 5 Ton Mini-Bagger", "category": "Bagger", "subcategory": "Mini", "price_per_day": 180.00, "stock": 2, "city": "Berlin"},
    {"title": "JLG 1930ES 26' Scherenbühnen", "category": "Bühnen", "subcategory": "Scherenbühnen", "price_per_day": 95.00, "stock": 3, "city": "Munich"},
    {"title": "Toyota 8FBE20 5.000 lb Elektro-Gabelstapler", "category": "Gabelstapler", "subcategory": "Elektro", "price_per_day": 120.00, "stock": 2, "city": "Hamburg"},
    {"title": "CAT 320 GC 10 Ton Mittelklasse-Bagger", "category": "Bagger", "subcategory": "Mittelklasse", "price_per_day": 250.00, "stock": 1, "city": "Cologne"},
    {"title": "Genie GS-1930 19' Scherenbühnen", "category": "Bühnen", "subcategory": "Scherenbühnen", "price_per_day": 85.00, "stock": 4, "city": "Frankfurt"},
    {"title": "JCB 8018 1,5 Ton Mini-Bagger", "category": "Bagger", "subcategory": "Mini", "price_per_day": 150.00, "stock": 2, "city": "Stuttgart"},
    {"title": "Bobcat T650 8.000 lb Teleskoplader", "category": "Gabelstapler", "subcategory": "Teleskoplader", "price_per_day": 200.00, "stock": 1, "city": "Düsseldorf"},
]

# Helper functions for generating data per subcategory
def generate_master_name(subcategory_name: str, index: int) -> str:
    """Generate a realistic master name (German first and last name).
    
    Note: subcategory_name parameter is kept for compatibility but not used,
    as master names should be personal names, not profession-based.
    """
    first_names = ["Andreas", "Anna", "Julia", "Klaus", "Markus", "Michael", "Petra", "Sabine", 
                   "Stefan", "Thomas", "David", "Lisa", "Christian", "Sandra", "Martin", "Kathrin",
                   "Sebastian", "Nina", "Max", "Sophie", "Felix", "Laura", "Jan", "Maria", "Tim",
                   "Sarah", "Daniel", "Jessica", "Alexander", "Nicole", "Benjamin", "Melanie",
                   "Oliver", "Julia", "Tobias", "Nicole", "Patrick", "Jennifer", "Florian", "Melissa"]
    last_names = ["Richter", "Schmidt", "Fischer", "Muller", "Becker", "Schneider", "Hoffmann", "Koch",
                  "Wagner", "Weber", "Bauer", "Hoffmann", "Koenig", "Herrmann", "Lehmann", "Wolf",
                  "Krause", "Stein", "Mustermann", "Neumann", "Schulz", "Meier", "Huber", "Gruber",
                  "Zimmermann", "Braun", "Hartmann", "Lange", "Werner", "Schulze", "Kraus", "Boehm"]
    # Use index to select names, ensuring variety
    first_idx = index % len(first_names)
    last_idx = (index * 7 + index // 3) % len(last_names)  # More variation in last names
    return f"{first_names[first_idx]} {last_names[last_idx]}"

def generate_master_email(name: str, index: int) -> str:
    """Generate email from master name"""
    name_parts = name.lower().split()
    if len(name_parts) >= 2:
        return f"{name_parts[0]}.{name_parts[1]}{index}@example.com"
    else:
        return f"{name_parts[0]}{index}@example.com"

def generate_unique_email(name: str, role: Role, existing_emails: set, start_index: int = 0) -> str:
    """Generate a unique email that doesn't exist in the set"""
    name_parts = name.lower().split()
    base_email = f"{name_parts[0]}.{name_parts[1]}" if len(name_parts) >= 2 else name_parts[0]
    index = start_index
    while True:
        email = f"{base_email}{index}@example.com"
        if email not in existing_emails:
            existing_emails.add(email)
            return email
        index += 1

def generate_product_name(subcategory_name: str, index: int, brand: Optional[str] = None) -> str:
    """Generate realistic product name based on subcategory"""
    # Model number patterns
    model_patterns = [
        lambda i: f"{random.randint(100, 999)}",
        lambda i: f"{chr(65 + (i % 26))}{random.randint(10, 99)}",
        lambda i: f"{random.randint(1, 9)}.{random.randint(1, 9)}",
        lambda i: f"{random.randint(10, 99)}V",
        lambda i: f"{random.randint(100, 999)}-{random.randint(10, 99)}",
        lambda i: f"{chr(65 + (i % 26))}{chr(65 + ((i*2) % 26))}{random.randint(100, 999)}",
    ]
    
    # Subcategory-specific naming patterns
    subcategory_lower = subcategory_name.lower()
    
    # Power tools - use voltage/specs
    if subcategory_lower in ["bohrmaschinen", "sägen", "schleifmaschinen", "schleifer", "fräsen", "nagelpistolen", "multifunktionswerkzeuge", "hobelmaschinen"]:
        voltage = random.choice([12, 18, 20, 24, 36, 40])
        model = model_patterns[index % len(model_patterns)](index)
        if brand:
            return f"{brand} {model} {voltage}V {subcategory_name}"
        return f"{model} {voltage}V {subcategory_name}"
    
    # Hand tools - use set/kit sizes
    if subcategory_lower in ["schraubendreher", "schraubenschlüssel", "hämmer", "zangen", "schneidwerkzeuge", "meißel", "feilen", "spannzangen"]:
        sizes = ["6-teilig", "8-teilig", "10-teilig", "12-teilig", "15-teilig", "20-teilig"]
        model = model_patterns[index % len(model_patterns)](index)
        if brand:
            return f"{brand} {model} {random.choice(sizes)} {subcategory_name}-Set"
        return f"{model} {random.choice(sizes)} {subcategory_name}-Set"
    
    # Painting tools - use size/material
    if subcategory_lower in ["pinsel", "walzen", "spritzgeräte"]:
        sizes = ["2\"", "3\"", "4\"", "6\"", "9\"", "12\""]
        materials = ["Synthetisch", "Naturborste", "Schaum", "Mikrofaser"]
        model = model_patterns[index % len(model_patterns)](index)
        if brand:
            return f"{brand} {model} {random.choice(sizes)} {random.choice(materials)} {subcategory_name}"
        return f"{model} {random.choice(sizes)} {random.choice(materials)} {subcategory_name}"
    
    # Plumbing tools - use size/specs
    if subcategory_lower in ["rohrzangen", "rohrschneider", "gewindeschneider", "rohrreinigungsspiralen", "presswerkzeuge", "rohrbieger"]:
        sizes = ["1/2\"", "3/4\"", "1\"", "1-1/4\"", "2\"", "3\""]
        model = model_patterns[index % len(model_patterns)](index)
        if brand:
            return f"{brand} {model} {random.choice(sizes)} {subcategory_name}"
        return f"{model} {random.choice(sizes)} {subcategory_name}"
    
    # Safety equipment - use size/rating
    if subcategory_lower in ["helme", "brillen", "gehörschutz", "masken", "handschuhe", "stiefel", "warnwesten", "knieschützer"]:
        ratings = ["ANSI", "CE", "OSHA", "EN"]
        model = model_patterns[index % len(model_patterns)](index)
        if brand:
            return f"{brand} {model} {random.choice(ratings)} Zertifiziert {subcategory_name}"
        return f"{model} {random.choice(ratings)} Zertifiziert {subcategory_name}"
    
    # Storage - use size/capacity
    if subcategory_lower in ["werkzeugkästen", "schränke", "taschen", "regale", "wagen", "behälter"]:
        sizes = ["Klein", "Mittel", "Groß", "XL", "Schwerlast"]
        model = model_patterns[index % len(model_patterns)](index)
        if brand:
            return f"{brand} {model} {random.choice(sizes)} {subcategory_name}"
        return f"{model} {random.choice(sizes)} {subcategory_name}"
    
    # Electrical tools - use voltage/rating
    if subcategory_lower in ["tester", "abisolierzangen", "crimpzangen", "kabelkanäle", "sicherungen", "steckdosen", "kabel", "verbindungen"]:
        voltage = random.choice([120, 240, 600, 1000])
        model = model_patterns[index % len(model_patterns)](index)
        if brand:
            return f"{brand} {model} {voltage}V {subcategory_name}"
        return f"{model} {voltage}V {subcategory_name}"
    
    # HVAC tools - use capacity/specs
    if subcategory_lower in ["manometer", "vakuumpumpen", "leckdetektoren", "kanalwerkzeuge", "thermometer", "filter"]:
        capacities = ["1/4 HP", "1/2 HP", "1 HP", "2 HP", "5 Ton", "10 Ton"]
        model = model_patterns[index % len(model_patterns)](index)
        if brand:
            return f"{brand} {model} {random.choice(capacities)} {subcategory_name}"
        return f"{model} {random.choice(capacities)} {subcategory_name}"
    
    # Cleaning equipment - use capacity/power
    if subcategory_lower in ["hochdruckreiniger", "staubsauger", "besen", "mopps", "bürsten", "schwämme", "tücher", "eimer"]:
        power = random.choice([1500, 2000, 2500, 3000, 3500])
        model = model_patterns[index % len(model_patterns)](index)
        if brand:
            return f"{brand} {model} {power}W {subcategory_name}"
        return f"{model} {power}W {subcategory_name}"
    
    # Garden tools - use size/power
    if subcategory_lower in ["rasenmäher", "gartenscheren", "schaufeln", "rechen", "schläuche", "sprinkler", "schubkarren", "scheren"]:
        sizes = ["20\"", "22\"", "24\"", "26\"", "30\"", "Schwerlast"]
        model = model_patterns[index % len(model_patterns)](index)
        if brand:
            return f"{brand} {model} {random.choice(sizes)} {subcategory_name}"
        return f"{model} {random.choice(sizes)} {subcategory_name}"
    
    # Default pattern
    model = model_patterns[index % len(model_patterns)](index)
    if brand:
        return f"{brand} {model} {subcategory_name}"
    return f"{model} {subcategory_name}"

def generate_rental_name(subcategory_name: str, index: int) -> str:
    """Generate realistic rental name based on subcategory"""
    # Equipment brands for rentals
    rental_brands = ["CAT", "JCB", "JLG", "Genie", "Bobcat", "Case", "Komatsu", "Volvo", "Liebherr", "Hitachi", "Kubota", "Yanmar"]
    brand = rental_brands[index % len(rental_brands)]
    
    # Model number patterns for rentals
    model_patterns = [
        lambda i: f"{random.randint(200, 999)}",
        lambda i: f"{random.randint(300, 999)}.{random.randint(1, 9)}",
        lambda i: f"{random.randint(100, 999)}-{random.randint(10, 99)}",
        lambda i: f"{chr(65 + (i % 26))}{random.randint(100, 999)}",
        lambda i: f"{random.randint(1, 9)}{chr(65 + (i % 26))}{random.randint(10, 99)}",
    ]
    
    model = model_patterns[index % len(model_patterns)](index)
    
    # Subcategory-specific naming patterns
    subcategory_lower = subcategory_name.lower()
    
    # Excavators - use weight class
    if subcategory_lower in ["mini", "mittelklasse", "groß", "räder", "raupen", "langausleger", "nullschwanz", "anbaugeräte"]:
        weights = ["1,5 Ton", "3 Ton", "5 Ton", "8 Ton", "12 Ton", "20 Ton", "30 Ton"]
        return f"{brand} {model} {random.choice(weights)} {subcategory_name} Bagger"
    
    # Lifts - use height/reach
    if subcategory_lower in ["scherenbühnen", "teleskopbühnen", "mastbühnen", "spider-bühnen", "arbeitsbühnen", "gerüste", "leitern"]:
        heights = ["19'", "26'", "32'", "40'", "50'", "60'", "80'"]
        return f"{brand} {model} {random.choice(heights)} {subcategory_name}"
    
    # Forklifts - use capacity
    if subcategory_lower in ["elektro", "diesel", "schubmaststapler", "hubwagen", "stapler", "teleskoplader", "kommissioniergeräte"]:
        capacities = ["3,000 lb", "5,000 lb", "6,000 lb", "8,000 lb", "10,000 lb", "15,000 lb"]
        return f"{brand} {model} {random.choice(capacities)} {subcategory_name}"
    
    # Concrete equipment - use capacity
    if subcategory_lower in ["mischer", "pumpen", "glättmaschinen", "schleifer", "sägen", "rüttler", "schalungen"]:
        capacities = ["3.5 cu ft", "5 cu ft", "9 cu ft", "12 cu ft", "20 cu ft"]
        return f"{brand} {model} {random.choice(capacities)} {subcategory_name}"
    
    # Generators - use power output
    if subcategory_lower in ["diesel", "gas", "solar", "batterie", "beleuchtung", "verteilung"]:
        power = random.choice([5000, 8000, 10000, 15000, 20000, 30000])
        return f"{brand} {model} {power}W {subcategory_name} Generator"
    
    # Climate control - use capacity
    if subcategory_lower in ["klimaanlagen", "heizgeräte", "ventilatoren", "entfeuchter", "luftreiniger", "lüftung"]:
        capacities = ["12,000 BTU", "18,000 BTU", "24,000 BTU", "36,000 BTU"]
        return f"{brand} {model} {random.choice(capacities)} {subcategory_name}"
    
    # Site facilities - use size/capacity
    if subcategory_lower in ["büros", "toiletten", "container", "zäune", "abfall", "sozialeinrichtungen"]:
        sizes = ["10'", "20'", "40'", "Standard", "Groß"]
        return f"{brand} {model} {random.choice(sizes)} {subcategory_name}"
    
    # Survey equipment - use accuracy/range
    if subcategory_lower in ["tachymeter", "gps", "nivelliere", "laser", "drohnen", "messgeräte"]:
        specs = ["±2mm", "±5mm", "±10mm", "1000m Range", "2000m Range"]
        return f"{brand} {model} {random.choice(specs)} {subcategory_name}"
    
    # Trucks - use capacity
    if subcategory_lower in ["kipper", "pritschenwagen", "wassertankwagen", "tankwagen", "kranwagen", "anhänger"]:
        capacities = ["5 Ton", "10 Ton", "15 Ton", "20 Ton", "25 Ton"]
        return f"{brand} {model} {random.choice(capacities)} {subcategory_name}"
    
    # Compactors - use weight/force
    if subcategory_lower in ["platte", "walzen", "rammgerät", "stampfer", "vibrations", "handgeführte", "fahrbare"]:
        weights = ["150 lb", "300 lb", "500 lb", "800 lb", "1.200 lb"]
        return f"{brand} {model} {random.choice(weights)} {subcategory_name} Verdichter"
    
    # Default pattern
    return f"{brand} {model} {subcategory_name}"

def generate_service_titles(subcategory_name: str) -> list[dict]:
    """Generate 3+ service titles for a subcategory"""
    base_services = [
        {"title": f"{subcategory_name} Service", "description": f"Professioneller {subcategory_name.lower()}-Service mit fachkundiger Aufmerksamkeit für Details", "price_from": 80.0 + random.random() * 120.0},
        {"title": f"{subcategory_name} Installation", "description": f"Kompletter {subcategory_name.lower()}-Installationsservice", "price_from": 120.0 + random.random() * 180.0},
        {"title": f"{subcategory_name} Reparatur", "description": f"Fachkundige {subcategory_name.lower()}-Reparatur und Wartung", "price_from": 60.0 + random.random() * 100.0},
        {"title": f"{subcategory_name} Beratung", "description": f"Professionelle Beratung für {subcategory_name.lower()}-Projekte", "price_from": 50.0 + random.random() * 80.0},
        {"title": f"{subcategory_name} Wartung", "description": f"Regelmäßiger Wartungsservice für {subcategory_name.lower()}", "price_from": 70.0 + random.random() * 110.0},
    ]
    return base_services[:3 + random.randint(0, 2)]  # Return 3-5 services

def seed_database(create_media_files: bool = False):
    """Seed database with sample data"""
    Base.metadata.create_all(bind=engine)
    
    with SessionLocal() as db:
        # Ensure cities are present and coordinates cache is ready
        created_cities = seed_german_cities(db)
        if created_cities:
            print(f"Seeded {created_cities} German city records")
        refresh_city_coordinates_cache(db)

        # Check if data already exists
        if db.query(User).count() > 1:  # More than just admin
            print("Database already seeded. Use SEED_DB_ON_START=true to reseed.")
            return
        
        print("Seeding database with sample data...")
        
        # ============================================
        # 1. USERS
        # ============================================
        print("Creating users...")
        
        # Admin user - MUST be created first to get id=1
        admin = db.query(User).filter(User.email == "admin@allesinda.io").first()
        if not admin:
            admin = User(
                email="admin@allesinda.io",
                name="Administrator",
                role=Role.admin,
                hashed_password=get_password_hash("admin123"),
                email_verified=True,
                is_active=True
            )
            db.add(admin)
            db.flush()
            admin_lat, admin_lon = get_city_coordinates("Berlin")
            admin_city_id = _find_city_id(db, "Berlin")
            admin_profile = Profile(
                user_id=admin.id,
                city_id=admin_city_id,
                about="Systemadministrator",
                verified=True,
                rating=5.0,
                latitude=admin_lat,
                longitude=admin_lon,
            )
            db.add(admin_profile)
            db.flush()
            
            db.commit()  # Commit admin first to ensure it gets id=1
            print("  ✓ Admin user created (id=1)")
        
        master_users = []
        seller_users = []
        client_users = []
        
        # Helper function to get city_id from city name
        def get_city_id_by_name(city_name: str) -> int | None:
            return _find_city_id(db, city_name)
        
        # Generate client users for reviews and orders
        print("Creating client users...")
        client_first_names = ["Felix", "Laura", "Jan", "Maria", "Tim", "Sarah", "Daniel", "Jessica", 
                              "Alexander", "Nicole", "Benjamin", "Melanie", "Kevin", "Julia", "Tom",
                              "Emma", "Lukas", "Hannah", "Jonas", "Lisa", "Paul", "Anna", "Simon", "Marie"]
        client_last_names = ["Schulz", "Meier", "Huber", "Gruber", "Bauer", "Wagner", "Fischer", "Weber",
                             "Meyer", "Schmidt", "Schneider", "Koch", "Zimmermann", "Brown", "Klein"]
        
        # Collect existing emails to avoid duplicates
        existing_emails = {user.email for user in db.query(User).all()}
        
        # Create 22 client users
        for i in range(22):
            first_name = client_first_names[i % len(client_first_names)]
            last_name = client_last_names[(i * 3) % len(client_last_names)]
            city_name = list(_CITY_COORDINATES_FALLBACK.keys())[i % len(_CITY_COORDINATES_FALLBACK)]
            city_id = get_city_id_by_name(city_name)
            
            client_name = f"{first_name} {last_name}"
            client_email = generate_unique_email(client_name, Role.client, existing_emails, i + 1)
            
            user = User(
                email=client_email,
                name=client_name,
                role=Role.client,
                hashed_password=get_password_hash("password123"),
                email_verified=True,
                is_active=True,
                phone=f"+49151240{i + 2:04d}",  # Start from 2 (admin is 1)
            )
            db.add(user)
            db.flush()
            
            # Create profile for client
            # Get coordinates for the city
            lat, lon = get_city_coordinates(city_name)
            profile = Profile(
                user_id=user.id,
                city_id=city_id,
                latitude=lat,
                longitude=lon
            )
            db.add(profile)
            db.flush()
            
            client_users.append(user)
            if i < 5:  # Print first 5
                print(f"  ✓ Client user created: {client_name}")
        
        db.commit()
        print(f"Created {len(client_users)} client users")
        
        # ============================================
        # 1.5. CATEGORIES
        # ============================================
        print("\nCreating categories...")
        
        category_slug_map: dict[CategoryType, dict[str, str]] = {category_type: {} for category_type in CategoryType}
        
        def create_category_slug(name: str) -> str:
            """Create URL-friendly slug from category name"""
            return name.lower().replace(" ", "-").replace("&", "and")
        
        def upsert_category(category_data: dict, category_type: CategoryType, sort_order: int, parent: Optional[Category] = None) -> Category:
            payload = category_data.copy()
            original_name = payload["name"]
            
            # Category names should be simple and clean, matching project style
            # Names are NOT prefixed with type - use original name as-is
            # Uniqueness is handled via slugs (which include type prefix)
            final_name = original_name
            
            base_slug = payload.get("slug") or create_category_slug(original_name)
            
            if parent:
                # Subcategories: create unique slug by including type and parent
                # Format: "{type}-{parent-base-slug}-{subcategory-slug}"
                # Example: "product-power-tools-drills" or "master-plumbing-installation"
                # Extract base slug from parent (remove type prefix if present)
                parent_base_slug = parent.slug
                type_prefix = f"{category_type.value}-"
                if parent_base_slug.startswith(type_prefix):
                    parent_base_slug = parent_base_slug[len(type_prefix):]
                slug = f"{category_type.value}-{parent_base_slug}-{base_slug}"
            else:
                # Main category slug includes type prefix: "{type}-{category-slug}"
                slug = f"{category_type.value}-{base_slug}"
            
            # Check by slug AND type (most specific identifier)
            # This ensures we don't accidentally update a category of a different type
            existing = db.query(Category).filter(
                Category.slug == slug,
                Category.type == category_type
            ).first()
            if existing:
                # Update existing category
                # Check if name conflicts with another category of the same type and parent
                # Names can be the same across different types (e.g., "Drills" in Product and Master)
                name_conflict = db.query(Category).filter(
                    Category.name == final_name,
                    Category.type == category_type,
                    Category.parent_id == (parent.id if parent else None),
                    Category.id != existing.id
                ).first()
                if name_conflict:
                    # Name conflict within same type and parent - add numeric suffix
                    counter = 1
                    test_name = f"{original_name} {counter}"
                    while db.query(Category).filter(
                        Category.name == test_name,
                        Category.type == category_type,
                        Category.parent_id == (parent.id if parent else None),
                        Category.id != existing.id
                    ).first():
                        counter += 1
                        test_name = f"{original_name} {counter}"
                    final_name = test_name
                
                existing.name = final_name
                existing.type = category_type
                existing.description = payload.get("description")
                existing.image_url = payload.get("image_url") or existing.image_url
                existing.sort_order = payload.get("sort_order", sort_order)
                existing.parent_id = parent.id if parent else None
                existing.is_active = payload.get("is_active", True)
                existing.slug = slug
                category = existing
            else:
                # Create new category
                # Check for name conflicts within the same type and parent
                # Names can be the same across different types (e.g., "Drills" in Product and Master)
                name_check = db.query(Category).filter(
                    Category.name == final_name,
                    Category.type == category_type,
                    Category.parent_id == (parent.id if parent else None)
                ).first()
                if name_check:
                    # Name conflict within same type and parent - add numeric suffix
                    counter = 1
                    test_name = f"{original_name} {counter}"
                    while db.query(Category).filter(
                        Category.name == test_name,
                        Category.type == category_type,
                        Category.parent_id == (parent.id if parent else None)
                    ).first():
                        counter += 1
                        test_name = f"{original_name} {counter}"
                    final_name = test_name
                
                # Check for slug conflicts globally (slugs must be unique across all types)
                # The slug format includes type prefix to prevent duplicates across types
                slug_check = db.query(Category).filter(Category.slug == slug).first()
                if slug_check:
                    # Slug conflict - add numeric suffix to ensure uniqueness
                    counter = 1
                    if parent:
                        # Subcategory: add suffix to subcategory part
                        base_slug_part = create_slug(original_name)
                        parent_base_slug = parent.slug
                        type_prefix = f"{category_type.value}-"
                        if parent_base_slug.startswith(type_prefix):
                            parent_base_slug = parent_base_slug[len(type_prefix):]
                        test_slug = f"{category_type.value}-{parent_base_slug}-{base_slug_part}-{counter}"
                        while db.query(Category).filter(Category.slug == test_slug).first():
                            counter += 1
                            test_slug = f"{category_type.value}-{parent_base_slug}-{base_slug_part}-{counter}"
                    else:
                        # Main category: add suffix to category part
                        base_slug_part = create_slug(original_name)
                        test_slug = f"{category_type.value}-{base_slug_part}-{counter}"
                        while db.query(Category).filter(Category.slug == test_slug).first():
                            counter += 1
                            test_slug = f"{category_type.value}-{base_slug_part}-{counter}"
                    slug = test_slug
                
                category = Category(
                    name=final_name,
                    slug=slug,
                    type=category_type,
                    description=payload.get("description"),
                    image_url=payload.get("image_url"),
                    sort_order=payload.get("sort_order", sort_order),
                    parent_id=parent.id if parent else None,
                    is_active=payload.get("is_active", True)
                )
                db.add(category)

            db.flush()
            
            # Only generate images for main categories, not subcategories
            if not parent:
                # Use numbered format for category images: "{type}-{index:02d}.jpeg"
                # Examples: "master-01.jpeg", "product-01.jpeg", "rental-01.jpeg"
                image_url = payload.get("image_url") or ensure_category_hero(
                    slug,  # Full slug (e.g., "product-power-tools")
                    original_name,  # Original category name
                    create_media_files=create_media_files,
                    category_type=category_type.value,  # Pass category type (master, product, rental)
                    index=sort_order + 1 if category_type in (CategoryType.master, CategoryType.product, CategoryType.rental) else None,  # Index for numbered format (1-based)
                )
                category.image_url = image_url
            
            # Use the actual category name (which may have been modified to avoid conflicts)
            actual_name = category.name
            category_slug_map.setdefault(category_type, {})[actual_name] = slug
            category_slug_map.setdefault(category_type, {})[actual_name.lower()] = slug
            category_slug_map.setdefault(category_type, {})[slug] = slug
            # Also map original name if it was modified
            if actual_name != payload.get("name"):
                original_name = payload.get("name")
                category_slug_map.setdefault(category_type, {})[original_name] = slug
                category_slug_map.setdefault(category_type, {})[original_name.lower()] = slug
            return category
        
        # Create category_id_map to store category IDs by name (for lookup)
        category_id_map: dict[CategoryType, dict[str, int]] = {category_type: {} for category_type in CategoryType}

        for category_type, groups in CATEGORY_HIERARCHY.items():
            print(f"  > {category_type.value.title()} categories ({len(groups)} main categories)")
            categories_created = 0
            categories_updated = 0
            categories_new = 0
            
            # Get existing categories before we start
            existing_slugs = {cat.slug for cat in db.query(Category).filter(Category.type == category_type, Category.parent_id.is_(None)).all()}
            
            for index, group in enumerate(groups):
                children = group.get("children", [])
                group_payload = {k: v for k, v in group.items() if k != "children"}
                original_slug = create_slug(group_payload["name"])
                was_new = original_slug not in existing_slugs
                
                parent_category = upsert_category(group_payload, category_type, sort_order=index)
                categories_created += 1
                if was_new:
                    categories_new += 1
                else:
                    categories_updated += 1
                
                print(f"    ✓ Category {categories_created}/{len(groups)}: {parent_category.name} (slug: {parent_category.slug}) {'[NEW]' if was_new else '[UPDATED]'}")

                for child_index, child in enumerate(children):
                    child_category = upsert_category(child, category_type, sort_order=child_index, parent=parent_category)
                    # Store category ID in map
                    category_id_map.setdefault(category_type, {})[child_category.name] = child_category.id
                    category_id_map.setdefault(category_type, {})[child_category.name.lower()] = child_category.id
                    print(f"      └─ Subcategory ready: {child_category.name}")
            
            # Verify all categories were created
            actual_count = db.query(Category).filter(Category.type == category_type, Category.parent_id.is_(None)).count()
            if actual_count != len(groups):
                print(f"    ⚠ WARNING: Expected {len(groups)} {category_type.value} categories, but found {actual_count} in database!")
                print(f"    New: {categories_new}, Updated: {categories_updated}")
            else:
                print(f"    ✓ Successfully created/updated {categories_new} new and {categories_updated} existing categories")
        
        db.commit()
        
        # ============================================
        # 1.6. GENERATE MASTERS FOR EACH SUBCATEGORY
        # ============================================
        print("\nGenerating masters for each subcategory...")
        all_subcategories = {}
        for category_type, groups in CATEGORY_HIERARCHY.items():
            all_subcategories[category_type] = []
            for group in groups:
                for child in group.get("children", []):
                    subcategory_name = child["name"]
                    subcategory_slug = category_slug_map[category_type].get(subcategory_name.lower()) or create_slug(subcategory_name)
                    all_subcategories[category_type].append({
                        "name": subcategory_name,
                        "slug": subcategory_slug,
                        "parent": group["name"]
                    })
        
        # Create masters from constant array (8 masters)
        # Collect existing emails to avoid duplicates
        existing_emails = {user.email for user in db.query(User).all()}
        
        for idx, master_data in enumerate(MASTERS_DATA):
            # Find subcategory ID from category structure, ensuring it belongs to the specified category
            category_name = master_data.get("category")
            subcategory_name = master_data["subcategory"]
            subcategory_id = None
            
            # Look up category ID from the map
            subcategory_id = category_id_map.get(CategoryType.master, {}).get(subcategory_name) or category_id_map.get(CategoryType.master, {}).get(subcategory_name.lower())
            
            if not subcategory_id:
                # Fallback: query database directly - MUST be a subcategory (has parent_id)
                category_obj = db.query(Category).filter(
                    Category.name == subcategory_name,
                    Category.type == CategoryType.master,
                    Category.parent_id.isnot(None)  # Ensure it's a subcategory, not a parent
                ).first()
                if category_obj:
                    subcategory_id = category_obj.id
                    category_id_map.setdefault(CategoryType.master, {})[subcategory_name] = subcategory_id
                    category_id_map.setdefault(CategoryType.master, {})[subcategory_name.lower()] = subcategory_id
                else:
                    # Last resort: use first master subcategory
                    first_subcat = db.query(Category).filter(
                        Category.type == CategoryType.master,
                        Category.parent_id.isnot(None)
                    ).first()
                    if first_subcat:
                        subcategory_id = first_subcat.id
                    print(f"  ⚠ Warning: Master {master_data['name']} - subcategory '{subcategory_name}' not found in category '{category_name}', using fallback")
            
            # Get city information (city_id is an ID, city name is used to look it up)
            city_name = master_data.get("city", "Berlin")
            lat, lon = get_city_coordinates(city_name)
            city_id = _find_city_id(db, city_name)
            
            if not city_id:
                print(f"  ⚠ Warning: City '{city_name}' not found, using Berlin as fallback")
                city_id = _find_city_id(db, "Berlin")
                lat, lon = get_city_coordinates("Berlin")
            
            # Ensure email is unique
            master_email = master_data["email"]
            if master_email in existing_emails:
                master_email = generate_unique_email(master_data["name"], Role.master, existing_emails, idx)
            existing_emails.add(master_email)
            
            user = User(
                email=master_email,
                name=master_data["name"],
                role=Role.master,
                hashed_password=get_password_hash("password123"),
                email_verified=True,
                is_active=True,
                phone=f"+49151240{len(master_users) + len(client_users) + 2:04d}",
            )
            db.add(user)
            db.flush()
            
            # Generate profile image URL: uploads/profiles/user_id_name.jpeg
            # Create safe filename from user name: replace spaces and special chars with underscores
            safe_name = re.sub(r'[^a-zA-Z0-9_-]', '_', user.name.lower().strip())
            safe_name = re.sub(r'_+', '_', safe_name)  # Replace multiple underscores with single
            safe_name = safe_name[:50]  # Limit length
            profile_image_filename = f"{user.id}_{safe_name}.jpeg"
            
            # Create profile image file if requested
            if create_media_files:
                text_label = f"{user.name}\n{subcategory_name}"
                # Create profile image directly in profiles/ folder (not dated structure)
                upload_folder = get_upload_folder()
                profiles_dir = os.path.join(upload_folder, "profiles")
                os.makedirs(profiles_dir, exist_ok=True)
                
                file_path = os.path.join(profiles_dir, profile_image_filename)
                
                # Only create if file doesn't exist
                if not os.path.exists(file_path) and PIL_AVAILABLE:
                    try:
                        # Create placeholder image
                        img = Image.new('RGB', (400, 400), color=(100, 150, 200))
                        
                        # Add gradient effect
                        try:
                            from PIL import ImageDraw
                            draw = ImageDraw.Draw(img)
                            for y_pos in range(400):
                                ratio = y_pos / 400
                                r = int(100 * (1 - ratio * 0.2))
                                g = int(150 * (1 - ratio * 0.2))
                                b = int(200 * (1 - ratio * 0.2))
                                draw.line([(0, y_pos), (400, y_pos)], fill=(r, g, b))
                        except:
                            pass
                        
                        # Add text label
                        if text_label:
                            try:
                                from PIL import ImageDraw, ImageFont
                                draw = ImageDraw.Draw(img)
                                font_size = 40
                                try:
                                    font = ImageFont.truetype("arial.ttf", font_size)
                                except:
                                    font = ImageFont.load_default()
                                
                                lines = text_label.split('\n')
                                line_heights = []
                                line_widths = []
                                for line in lines:
                                    bbox = draw.textbbox((0, 0), line, font=font)
                                    line_heights.append(bbox[3] - bbox[1])
                                    line_widths.append(bbox[2] - bbox[0])
                                
                                total_height = sum(line_heights) + (len(lines) - 1) * 10
                                max_width = max(line_widths) if line_widths else 0
                                
                                x = (400 - max_width) // 2
                                y = (400 - total_height) // 2
                                
                                # Draw semi-transparent background
                                padding = 20
                                overlay = Image.new('RGBA', (400, 400), (0, 0, 0, 0))
                                overlay_draw = ImageDraw.Draw(overlay)
                                overlay_draw.rectangle(
                                    [x - padding, y - padding, x + max_width + padding, y + total_height + padding],
                                    fill=(0, 0, 0, 180)
                                )
                                img = Image.alpha_composite(img.convert('RGBA'), overlay).convert('RGB')
                                draw = ImageDraw.Draw(img)
                                
                                # Draw text
                                current_y = y
                                for i, line in enumerate(lines):
                                    line_bbox = draw.textbbox((0, 0), line, font=font)
                                    line_width = line_bbox[2] - line_bbox[0]
                                    line_x = (400 - line_width) // 2
                                    draw.text((line_x, current_y), line, fill=(255, 255, 255), font=font)
                                    current_y += line_heights[i] + 10
                            except Exception as e:
                                print(f"Warning: Could not add text to profile image: {e}")
                        
                        img.save(file_path, 'JPEG', quality=85)
                    except Exception as e:
                        print(f"Warning: Could not create profile image: {e}")
                
                profile_image_url = build_media_url("profiles", profile_image_filename)
            else:
                profile_image_url = build_media_url("profiles", profile_image_filename)
            
            profile = Profile(
                user_id=user.id,
                city_id=city_id,
                about=f"Professional {subcategory_name.lower()} specialist with {5 + random.randint(5, 20)} years of experience",
                category_id=subcategory_id,
                image_url=profile_image_url,  # Profile image in uploads/profiles/ directory
                verified=random.random() > 0.2,  # 80% verified
                rating=round(4.0 + random.random() * 1.0, 2),
                total_reviews=random.randint(5, 50),
                completed_jobs=random.randint(10, 100),
                response_time_hours=random.randint(1, 6),
                latitude=lat,
                longitude=lon,
            )
            db.add(profile)
            master_users.append((user, profile))
        
        db.commit()
        print(f"  ✓ Total masters created: {len(master_users)}")
        
        # ============================================
        # 1.7. GENERATE SELLERS FOR PRODUCTS/RENTALS
        # ============================================
        print("\nGenerating additional sellers...")
        # Collect existing emails to avoid duplicates
        existing_emails = {user.email for user in db.query(User).all()}
        seller_start_index = len(seller_users) + len(client_users) + len(master_users) + 2  # +2 for admin
        
        for i in range(30):  # Add 30 more sellers
            seller_name = generate_master_name("Seller", seller_start_index + i)
            seller_email = generate_unique_email(seller_name, Role.seller, existing_emails, seller_start_index + i)
            city_name = random.choice(list(_CITY_COORDINATES_FALLBACK.keys()))
            city_id = _find_city_id(db, city_name)
            lat, lon = get_city_coordinates(city_name)
            
            user = User(
                email=seller_email,
                name=seller_name,
                role=Role.seller,
                hashed_password=get_password_hash("password123"),
                email_verified=True,
                is_active=True,
                phone=f"+49151240{seller_start_index + i:04d}",
            )
            db.add(user)
            db.flush()
            
            # Create profile for seller
            profile = Profile(
                user_id=user.id,
                city_id=city_id,
                latitude=lat,
                longitude=lon
            )
            db.add(profile)
            db.flush()
            
            seller_users.append(user)
        
        db.commit()
        print(f"  ✓ Total sellers: {len(seller_users)}")
        
        # ============================================
        # 2. SERVICES
        # ============================================
        print("\nCreating services...")
        # Comprehensive service mapping for all master subcategories - realistic and useful services
        # Using composite keys (category:subcategory) for duplicate subcategory names
        service_mapping = {
            # Plumbing subcategories
            "Sanitär:Reparaturen": [
                {"title": "Leckreparatur-Service", "description": "Fachkundige Reparatur von Wasserlecks in Rohren, Armaturen und Sanitäranlagen", "price_from": 85.0},
                {"title": "Armaturenreparatur", "description": "Reparatur und Austausch von defekten Wasserhähnen, Waschbecken und Toiletten", "price_from": 75.0},
                {"title": "Rohrreparatur & Austausch", "description": "Reparatur beschädigter oder geplatzter Rohre mit professionellen Lösungen", "price_from": 120.0},
                {"title": "Wasserdruckreparatur", "description": "Diagnose und Behebung von Niedrigwasserdruckproblemen", "price_from": 95.0},
                {"title": "Toilettenreparatur-Service", "description": "Behebung von laufenden Toiletten, Verstopfungen und Spülproblemen", "price_from": 70.0}
            ],
            "Sanitär:Installation": [
                {"title": "Armatureninstallation", "description": "Professionelle Installation von Waschbecken, Wasserhähnen, Toiletten und Duschen", "price_from": 150.0},
                {"title": "Rohrinstallation", "description": "Neue Rohrinstallation für Renovierungen und Neubauten", "price_from": 200.0},
                {"title": "Wasserleitungsinstallation", "description": "Installation neuer Wasserversorgungsleitungen und Anschlüsse", "price_from": 180.0},
                {"title": "Badezimmerinstallation", "description": "Kompletter Badezimmer-Armaturen-Installationsservice", "price_from": 300.0}
            ],
            "Abflussreinigung": [
                {"title": "Abflussreinigung", "description": "Professionelle Abflussreinigung für Waschbecken, Duschen und Toiletten", "price_from": 90.0},
                {"title": "Kanalreinigung", "description": "Tiefenreinigung von Hauptkanalleitungen und Rohren", "price_from": 150.0},
                {"title": "Hochdruckreinigungsservice", "description": "Hochdruck-Wasserstrahlreinigung für hartnäckige Verstopfungen", "price_from": 180.0},
                {"title": "Abflussinspektion", "description": "Kamerainspektion zur Identifizierung von Abflussproblemen", "price_from": 120.0}
            ],
            "Leckerkennung": [
                {"title": "Wassereleck-Erkennung", "description": "Fortschrittliche Leckerkennung mit spezialisierter Ausrüstung", "price_from": 150.0},
                {"title": "Versteckte Leckreparatur", "description": "Lokalisierung und Reparatur von Lecks hinter Wänden und unterirdisch", "price_from": 200.0},
                {"title": "Thermische Leckerkennung", "description": "Infrarotkamera-Erkennung für versteckte Wasserlecks", "price_from": 180.0}
            ],
            "Warmwasserbereiter": [
                {"title": "Warmwasserbereiter-Installation", "description": "Professionelle Installation neuer Warmwasserbereiter", "price_from": 250.0},
                {"title": "Warmwasserbereiter-Reparatur", "description": "Reparatur und Wartung bestehender Warmwasserbereiter", "price_from": 120.0},
                {"title": "Warmwasserbereiter-Austausch", "description": "Entfernung alter und Installation neuer Warmwasserbereiter-Systeme", "price_from": 280.0}
            ],
            "Sanitär:Notfall": [
                {"title": "24/7 Notfall-Klempner", "description": "Rund-um-die-Uhr Notfall-Klempnerservice", "price_from": 150.0},
                {"title": "Geplatztes Rohr Notfall", "description": "Sofortige Reaktion auf geplatzte Rohre und Wasserschäden", "price_from": 200.0},
                {"title": "Kanalrückstau Notfall", "description": "Notfall-Kanalrückstau und Überlauf-Reinigung", "price_from": 250.0}
            ],
            "Armaturen": [
                {"title": "Wasserhahn-Installation", "description": "Installation neuer Wasserhähne und Armaturen in Küche und Badezimmer", "price_from": 100.0},
                {"title": "Waschbecken-Installation", "description": "Installation von Küchen- und Badezimmerwaschbecken", "price_from": 150.0},
                {"title": "Dusch-Installation", "description": "Installation neuer Duschsysteme und Armaturen", "price_from": 200.0}
            ],
            "Inspektion": [
                {"title": "Rohrkamera-Inspektion", "description": "Videoinspektion von Rohren und Abflüssen", "price_from": 120.0},
                {"title": "Sanitärsystem-Inspektion", "description": "Komplette Sanitärsystem-Bewertung", "price_from": 100.0}
            ],
            # Electrical subcategories
            "Elektrik:Reparaturen": [
                {"title": "Elektrische Fehlerreparatur", "description": "Diagnose und Behebung von elektrischen Problemen und Fehlern", "price_from": 90.0},
                {"title": "Steckdosenreparatur", "description": "Reparatur defekter oder fehlerhafter elektrischer Steckdosen", "price_from": 70.0},
                {"title": "Sicherungsreparatur", "description": "Behebung von auslösenden Sicherungen und Elektroverteilerproblemen", "price_from": 120.0},
                {"title": "Verkabelungsreparatur", "description": "Reparatur beschädigter oder fehlerhafter elektrischer Verkabelung", "price_from": 150.0},
                {"title": "Leuchtenreparatur", "description": "Reparatur nicht funktionierender Lichter und Leuchten", "price_from": 80.0}
            ],
            "Elektrik:Installation": [
                {"title": "Elektrische Steckdosen-Installation", "description": "Installation neuer elektrischer Steckdosen und Schalter", "price_from": 120.0},
                {"title": "Verkabelungsinstallation", "description": "Neue elektrische Verkabelung für Räume und Anbauten", "price_from": 200.0},
                {"title": "Stromkreis-Installation", "description": "Hinzufügen neuer Stromkreise zum Elektroverteiler", "price_from": 180.0},
                {"title": "FI-Schutzschalter-Installation", "description": "Installation von FI-Schutzschalter-Steckdosen für Sicherheit", "price_from": 100.0}
            ],
            "Beleuchtung": [
                {"title": "Einbauleuchten-Installation", "description": "Installation moderner Einbau-Deckenleuchten", "price_from": 150.0},
                {"title": "Kronleuchter-Installation", "description": "Aufhängen und Installation von Kronleuchtern und Pendelleuchten", "price_from": 120.0},
                {"title": "LED-Beleuchtungs-Upgrade", "description": "Upgrade auf energieeffiziente LED-Beleuchtung", "price_from": 200.0},
                {"title": "Außenbeleuchtungs-Installation", "description": "Installation von Landschafts- und Sicherheitsbeleuchtung", "price_from": 180.0},
                {"title": "Smart-Lighting-Einrichtung", "description": "Installation und Konfiguration von Smart-Light-Systemen", "price_from": 250.0}
            ],
            "Smart Home": [
                {"title": "Smart-Home-Einrichtung", "description": "Komplette Smart-Home-Automatisierungsinstallation", "price_from": 300.0},
                {"title": "Smart-Schalter-Installation", "description": "Installation von Smart-Schaltern und Dimmern", "price_from": 150.0},
                {"title": "Home-Assistant-Konfiguration", "description": "Einrichtung und Konfiguration von Hausautomatisierungssystemen", "price_from": 200.0}
            ],
            "Solar": [
                {"title": "Solarpanel-Installation", "description": "Professionelle Solarpanel-Systeminstallation", "price_from": 5000.0},
                {"title": "Solaranlagen-Wartung", "description": "Regelmäßige Wartung und Reinigung von Solarpanels", "price_from": 150.0},
                {"title": "Solar-Wechselrichter-Installation", "description": "Installation und Konfiguration von Solar-Wechselrichtern", "price_from": 800.0}
            ],
            "Neuverkabelung": [
                {"title": "Komplette Hausverkabelung", "description": "Vollständige elektrische Neuverkabelung der gesamten Immobilie", "price_from": 3000.0},
                {"title": "Raumverkabelung", "description": "Neuverkabelung einzelner Räume oder Bereiche", "price_from": 800.0},
                {"title": "Alte Verkabelung-Ersatz", "description": "Ersatz veralteter und unsicherer elektrischer Verkabelung", "price_from": 1500.0}
            ],
            "E-Auto-Ladestationen": [
                {"title": "E-Auto-Ladestation-Installation", "description": "Installation einer Heim-Elektrofahrzeug-Ladestation", "price_from": 600.0},
                {"title": "Level-2-Lader-Einrichtung", "description": "Installation schneller Level-2-E-Auto-Ladegeräte", "price_from": 800.0}
            ],
            "Verteiler": [
                {"title": "Elektroverteiler-Upgrade", "description": "Upgrade des Elektroverteilers für erhöhte Kapazität", "price_from": 1200.0},
                {"title": "Verteiler-Austausch", "description": "Austausch alter oder defekter Elektroverteiler", "price_from": 1000.0}
            ],
            "Prüfung": [
                {"title": "Elektrische Sicherheitsprüfung", "description": "Komplette elektrische Sicherheitsprüfung und Zertifizierung", "price_from": 150.0},
                {"title": "EICR-Zertifikat", "description": "Elektrische Installationszustandsbericht", "price_from": 200.0}
            ],
            # Cleaning subcategories
            "Regelmäßig": [
                {"title": "Wöchentlicher Reinigungsservice", "description": "Regelmäßiger wöchentlicher Hausreinigungsservice", "price_from": 80.0},
                {"title": "Zweiwöchentliche Reinigung", "description": "Alle zwei Wochen professionelle Reinigung", "price_from": 100.0},
                {"title": "Monatliche Reinigung", "description": "Monatliche Grundreinigungs-Wartung", "price_from": 120.0},
                {"title": "Einmalige Reinigung", "description": "Einzelsitzung professionelle Reinigung", "price_from": 90.0}
            ],
            "Grundreinigung": [
                {"title": "Grundreinigungsservice", "description": "Gründliche Grundreinigung des gesamten Hauses", "price_from": 200.0},
                {"title": "Frühjahrsputz", "description": "Umfassende saisonale Grundreinigung", "price_from": 250.0},
                {"title": "Reinigungsputz nach Renovierung", "description": "Komplette Reinigung nach Bauarbeiten", "price_from": 300.0}
            ],
            "Teppich": [
                {"title": "Teppichreinigung", "description": "Professionelle Dampfreinigung für Teppiche", "price_from": 120.0},
                {"title": "Läuferreinigung", "description": "Spezialisierte Reinigung für Läufer", "price_from": 100.0},
                {"title": "Polsterreinigung", "description": "Grundreinigung für Sofas und Möbel", "price_from": 150.0}
            ],
            "Reinigung:Fenster": [
                {"title": "Fensterreinigungsservice", "description": "Innen- und Außenfensterreinigung", "price_from": 80.0},
                {"title": "Hochfensterreinigung", "description": "Professionelle Reinigung von hohen Fenstern", "price_from": 120.0},
                {"title": "Fensterrahmenreinigung", "description": "Komplette Fenster- und Rahmenreinigung", "price_from": 100.0}
            ],
            "Auszug": [
                {"title": "Endreinigung bei Auszug", "description": "Komplette Auszugsreinigung für Mietobjekte", "price_from": 250.0},
                {"title": "Kaution-Reinigung", "description": "Professionelle Reinigung zur Sicherung der Kaution", "price_from": 280.0}
            ],
            "Büro": [
                {"title": "Büroreinigungsservice", "description": "Regelmäßige gewerbliche Büroreinigung", "price_from": 150.0},
                {"title": "Gewerbliche Grundreinigung", "description": "Gründliche Reinigung für Geschäftsräume", "price_from": 300.0}
            ],
            "Hochdruckreinigung": [
                {"title": "Außen-Hochdruckreinigung", "description": "Hochdruckreinigung von Gebäudefassaden", "price_from": 200.0},
                {"title": "Einfahrtreinigung", "description": "Hochdruckreinigung von Einfahrten und Wegen", "price_from": 120.0},
                {"title": "Terrassenreinigung", "description": "Hochdruckreinigung und Restaurierung von Terrassen", "price_from": 150.0}
            ],
            "Desinfektion": [
                {"title": "Desinfektionsservice", "description": "Professionelle Desinfektion und Sanitisierung", "price_from": 180.0},
                {"title": "COVID-19-Desinfektion", "description": "Spezialisierter Virus-Desinfektionsservice", "price_from": 200.0}
            ],
            # Security subcategories
            "Schlosserei": [
                {"title": "Schlossinstallation", "description": "Installation neuer Schlösser und Sicherheitssysteme", "price_from": 100.0},
                {"title": "Schlossreparatur-Service", "description": "Reparatur defekter oder fehlerhafter Schlösser", "price_from": 80.0},
                {"title": "Schlüsselduplikation", "description": "Professionelle Schlüsselherstellung und Duplikation", "price_from": 25.0},
                {"title": "Schloss-Umcodierung", "description": "Änderung der Schlosskombinationen ohne Austausch", "price_from": 70.0},
                {"title": "Hauptschlüsselsystem", "description": "Installation von Hauptschlüsselsystemen für Unternehmen", "price_from": 300.0}
            ],
            "Alarmanlagen": [
                {"title": "Einbruchsalarm-Installation", "description": "Installation kompletter Hausalarmsysteme", "price_from": 400.0},
                {"title": "Alarmsystem-Wartung", "description": "Regelmäßige Wartung und Prüfung von Alarmanlagen", "price_from": 100.0},
                {"title": "Alarmreparatur-Service", "description": "Reparatur defekter Alarmsysteme", "price_from": 120.0}
            ],
            "Kameras": [
                {"title": "Überwachungskamera-Installation", "description": "Installation von Sicherheitskamera-Systemen", "price_from": 500.0},
                {"title": "Sicherheitskamera-Einrichtung", "description": "Einrichtung und Konfiguration von Überwachungskameras", "price_from": 400.0},
                {"title": "Kamera-Wartung", "description": "Wartung und Reparatur von Sicherheitskameras", "price_from": 150.0}
            ],
            "Smart Locks": [
                {"title": "Smart-Lock-Installation", "description": "Installation von Smart-Lock-Systemen", "price_from": 250.0},
                {"title": "Schlüsselloser Zugang-Einrichtung", "description": "Einrichtung von schlüssellosen Zugangssystemen", "price_from": 300.0}
            ],
            "Zugangskontrolle": [
                {"title": "Zugangskontrolle-Installation", "description": "Installation von Zugangskontrollsystemen", "price_from": 600.0},
                {"title": "Chipkarten-System-Einrichtung", "description": "Einrichtung von Chipkarten-Zugangssystemen", "price_from": 500.0}
            ],
            "Schlüssel": [
                {"title": "Schlüsselherstellungsservice", "description": "Professionelle Schlüsselherstellung und Duplikation", "price_from": 20.0},
                {"title": "Autoschlüssel-Programmierung", "description": "Programmierung und Duplikation von Autoschlüsseln", "price_from": 150.0}
            ],
            "Tresore": [
                {"title": "Tresor-Installation", "description": "Installation und Sicherung von Tresoren", "price_from": 200.0},
                {"title": "Tresor-Öffnungsservice", "description": "Öffnung verschlossener Tresore ohne Beschädigung", "price_from": 150.0}
            ],
            "Notfall": [
                {"title": "24/7 Aussperrungsservice", "description": "Notfall-Aussperrungshilfe jederzeit", "price_from": 100.0},
                {"title": "Notfall-Schlossersatz", "description": "Sofortiger Schlossersatz-Service", "price_from": 150.0}
            ],
            # Roofing subcategories
            "Dachdecker:Reparaturen": [
                {"title": "Dachleckreparatur", "description": "Behebung von Dachlecks und Wasserschäden", "price_from": 300.0},
                {"title": "Dachziegelreparatur", "description": "Austausch beschädigter oder fehlender Dachziegel", "price_from": 200.0},
                {"title": "Dachabdichtung-Reparatur", "description": "Reparatur der Dachabdichtung um Schornsteine und Lüftungen", "price_from": 250.0},
                {"title": "Dachflick-Service", "description": "Flicken von Löchern und beschädigten Dachbereichen", "price_from": 180.0}
            ],
            "Ersatz": [
                {"title": "Kompletter Dachersatz", "description": "Vollständiger Dachersatz-Service", "price_from": 8000.0},
                {"title": "Dachziegelersatz", "description": "Austausch von Dachziegeln und Materialien", "price_from": 4000.0}
            ],
            "Regenrinnen": [
                {"title": "Regenrinne-Reinigung", "description": "Professioneller Regenrinne-Reinigungsservice", "price_from": 120.0},
                {"title": "Regenrinne-Installation", "description": "Installation neuer Regenrinnensysteme", "price_from": 400.0},
                {"title": "Regenrinne-Reparatur", "description": "Reparatur beschädigter oder undichter Regenrinnen", "price_from": 200.0}
            ],
            "Waterproofing": [
                {"title": "Dachabdichtung", "description": "Auftragen von Abdichtung auf Dachflächen", "price_from": 1500.0},
                {"title": "Flachdachabdichtung", "description": "Abdichtung von Flachdachsystemen", "price_from": 2000.0}
            ],
            "Inspektionen": [
                {"title": "Dachinspektionsservice", "description": "Umfassende Dachzustandsinspektion", "price_from": 150.0},
                {"title": "Vorkaufs-Dachinspektion", "description": "Dachinspektion vor Immobilienkauf", "price_from": 200.0}
            ],
            "Sturmschäden": [
                {"title": "Sturmschadenreparatur", "description": "Notfallreparatur nach Sturmschäden", "price_from": 500.0},
                {"title": "Hagelschadenreparatur", "description": "Reparatur hagelgeschädigter Dächer", "price_from": 400.0}
            ],
            "Dachfenster": [
                {"title": "Dachfenster-Installation", "description": "Installation neuer Dachfenster", "price_from": 800.0},
                {"title": "Dachfenster-Reparatur", "description": "Reparatur undichter oder beschädigter Dachfenster", "price_from": 300.0}
            ],
            # Carpentry subcategories
            "Möbel": [
                {"title": "Individuelle Möbelherstellung", "description": "Bau individueller Möbelstücke", "price_from": 500.0},
                {"title": "Möbelreparatur", "description": "Reparatur und Restaurierung beschädigter Möbel", "price_from": 150.0},
                {"title": "Möbelmontage", "description": "Montage von Flachpackmöbeln", "price_from": 80.0}
            ],
            "Schreinerei:Schränke": [
                {"title": "Küchenschrank-Installation", "description": "Installation von Küchenschränken", "price_from": 1200.0},
                {"title": "Badezimmerschrank-Installation", "description": "Installation von Badezimmer-Waschbecken und Schränken", "price_from": 600.0},
                {"title": "Schrankreparatur", "description": "Reparatur beschädigter Schränke und Türen", "price_from": 200.0}
            ],
            "Terrassen": [
                {"title": "Terrassenbau", "description": "Bau neuer Terrassen und Patios", "price_from": 3000.0},
                {"title": "Terrassenreparatur-Service", "description": "Reparatur beschädigter Terrassenbretter und Geländer", "price_from": 400.0},
                {"title": "Terrassenversiegelung", "description": "Versiegeln und Abdichten von Terrassenoberflächen", "price_from": 300.0}
            ],
            "Türen": [
                {"title": "Türinstallation", "description": "Installation von Innen- und Außentüren", "price_from": 250.0},
                {"title": "Türreparatur-Service", "description": "Reparatur von Türen, Rahmen und Beschlägen", "price_from": 150.0},
                {"title": "Schiebetür-Installation", "description": "Installation von Schiebetüren", "price_from": 500.0}
            ],
            "Schreinerei:Fenster": [
                {"title": "Fensterinstallation", "description": "Installation neuer Fenster", "price_from": 400.0},
                {"title": "Fensterrahmenreparatur", "description": "Reparatur beschädigter Fensterrahmen", "price_from": 200.0}
            ],
            "Gerüst": [
                {"title": "Wandgerüst", "description": "Gerüst für neue Wände und Strukturen", "price_from": 800.0},
                {"title": "Strukturelles Gerüst", "description": "Bau struktureller Gerüste für Anbauten", "price_from": 2000.0}
            ],
            "Verkleidung": [
                {"title": "Sockelleisten-Installation", "description": "Installation von Sockelleisten und Verkleidungen", "price_from": 300.0},
                {"title": "Kronleisten-Installation", "description": "Installation von Kronleisten und dekorativen Verkleidungen", "price_from": 400.0}
            ],
            "Regale": [
                {"title": "Individuelle Regal-Installation", "description": "Bau und Installation individueller Regale", "price_from": 400.0},
                {"title": "Einbauregale", "description": "Erstellung von Einbauregalen", "price_from": 600.0}
            ],
            "Treppen": [
                {"title": "Treppenbau", "description": "Bau neuer Treppen", "price_from": 2000.0},
                {"title": "Treppenreparatur", "description": "Reparatur beschädigter Treppen und Geländer", "price_from": 500.0}
            ],
            # Tiling subcategories
            "Fliesen:Reparatur": [
                {"title": "Fliesenreparatur-Service", "description": "Austausch gebrochener oder beschädigter Fliesen", "price_from": 150.0},
                {"title": "Fugenreparatur", "description": "Reparatur und Austausch beschädigter Fugen", "price_from": 100.0}
            ],
            "Fliesen:Boden": [
                {"title": "Bodenfliesen-Installation", "description": "Installation von Bodenfliesen in jedem Raum", "price_from": 600.0},
                {"title": "Bodenfliesenreparatur", "description": "Reparatur beschädigter Bodenfliesen", "price_from": 200.0}
            ],
            "Wand": [
                {"title": "Wandfliesen-Installation", "description": "Installation von Wandfliesen und Rückwänden", "price_from": 500.0},
                {"title": "Duschwand-Fliesen", "description": "Fliesen für Duschwände und Umgebungen", "price_from": 800.0}
            ],
            "Badezimmer": [
                {"title": "Badezimmer-Fliesenservice", "description": "Komplette Badezimmer-Flieseninstallation", "price_from": 1200.0},
                {"title": "Badezimmer-Fliesenreparatur", "description": "Reparatur von Badezimmer-Fliesen und Fugen", "price_from": 300.0}
            ],
            "Küche": [
                {"title": "Küchen-Rückwand-Installation", "description": "Installation von Küchen-Fliesenrückwänden", "price_from": 600.0},
                {"title": "Küchen-Bodenfliesen", "description": "Installation von Küchen-Bodenfliesen", "price_from": 800.0}
            ],
            "Waterproofing": [
                {"title": "Nassbereich-Abdichtung", "description": "Abdichtung von Duschen und Nassbereichen", "price_from": 800.0},
                {"title": "Badezimmer-Abdichtung", "description": "Komplette Badezimmer-Abdichtung", "price_from": 1000.0}
            ],
            "Fliesen:Fugen": [
                {"title": "Fugenreinigungsservice", "description": "Grundreinigung und Restaurierung von Fugen", "price_from": 200.0},
                {"title": "Fugenversiegelung", "description": "Versiegelung von Fugen zur Verhinderung von Verfärbungen", "price_from": 150.0}
            ],
            "Fußbodenheizung": [
                {"title": "Fußbodenheizungs-Installation", "description": "Installation elektrischer Fußbodenheizungen", "price_from": 1500.0},
                {"title": "Fußbodenheizungsreparatur", "description": "Reparatur von Fußbodenheizungssystemen", "price_from": 400.0}
            ],
            # Painting subcategories
            "Innen": [
                {"title": "Innenraum-Hausmalerei", "description": "Malen von Innenwänden und Decken", "price_from": 800.0},
                {"title": "Raummalerei-Service", "description": "Malen einzelner Räume", "price_from": 400.0},
                {"title": "Deckenmalerei", "description": "Professionelle Deckenmalerei", "price_from": 300.0}
            ],
            "Außen": [
                {"title": "Außen-Hausmalerei", "description": "Malen von Hausaußenwänden", "price_from": 2000.0},
                {"title": "Außen-Verkleidungsmalerei", "description": "Malen von Außenverkleidungen und Details", "price_from": 600.0}
            ],
            "Dekorativ": [
                {"title": "Akzentwand-Malerei", "description": "Erstellung dekorativer Akzentwände", "price_from": 500.0},
                {"title": "Strukturierte Farbaufträge", "description": "Auftrag strukturierter Farbaufträge", "price_from": 600.0}
            ],
            "Spritzlackierung": [
                {"title": "Spritzlackier-Service", "description": "Professionelle Spritzlackierung", "price_from": 1000.0},
                {"title": "Außen-Spritzlackierung", "description": "Spritzlackierung von Außenflächen", "price_from": 1500.0}
            ],
            "Malerei:Schränke": [
                {"title": "Schrank-Aufbereitung", "description": "Aufbereitung von Küchen- und Badezimmerschränken", "price_from": 800.0},
                {"title": "Schrankmalerei-Service", "description": "Malen von Schränken mit professionellem Finish", "price_from": 600.0}
            ],
            "Tapeten": [
                {"title": "Tapeten-Installation", "description": "Professionelles Tapetenkleben", "price_from": 500.0},
                {"title": "Tapetenentfernung", "description": "Entfernung alter Tapeten", "price_from": 300.0}
            ],
            "Terrasse": [
                {"title": "Terrassenversiegelungs-Service", "description": "Versiegeln und Schutz von Terrassenoberflächen", "price_from": 400.0},
                {"title": "Terrassenabdichtung", "description": "Abdichtung von Terrassen für Witterungsschutz", "price_from": 350.0}
            ],
            "Gewerblich": [
                {"title": "Gewerbliche Malerei", "description": "Malen von Gewerbegebäuden und Büros", "price_from": 2000.0},
                {"title": "Einzelhandelsraum-Malerei", "description": "Malen von Einzelhandelsgeschäften und Läden", "price_from": 1500.0}
            ],
            # HVAC subcategories
            "HLK:Installation": [
                {"title": "Klimaanlagen-Installation", "description": "Installation neuer Klimaanlagensysteme", "price_from": 2000.0},
                {"title": "Heizungsanlagen-Installation", "description": "Installation von Heizungssystemen", "price_from": 2500.0},
                {"title": "HLK-System-Installation", "description": "Komplette HLK-Systeminstallation", "price_from": 4000.0}
            ],
            "HLK:Reparatur": [
                {"title": "Klimaanlagen-Reparaturservice", "description": "Reparatur von Klimaanlagen", "price_from": 200.0},
                {"title": "Heizungsreparatur", "description": "Behebung von Heizungssystemproblemen", "price_from": 250.0},
                {"title": "HLK-Systemreparatur", "description": "Reparatur kompletter HLK-Systeme", "price_from": 300.0}
            ],
            "HLK:Wartung": [
                {"title": "Klimaanlagen-Wartungsservice", "description": "Regelmäßige Klimaanlagen-Wartung und Service", "price_from": 150.0},
                {"title": "Heizungssystem-Wartung", "description": "Jährliche Heizungssystem-Wartung", "price_from": 180.0},
                {"title": "HLK-System-Wartung", "description": "Komplette HLK-System-Wartung", "price_from": 200.0}
            ],
            "Kanalreinigung": [
                {"title": "Luftkanal-Reinigungsservice", "description": "Professionelle Luftkanalreinigung", "price_from": 300.0},
                {"title": "Lüftungsreinigung", "description": "Reinigung aller Luftschächte und Register", "price_from": 200.0}
            ],
            "Thermostate": [
                {"title": "Smart-Thermostat-Installation", "description": "Installation und Konfiguration von Smart-Thermostaten", "price_from": 250.0},
                {"title": "Thermostat-Austausch", "description": "Austausch alter Thermostate", "price_from": 150.0}
            ],
            "Wärmepumpen": [
                {"title": "Wärmepumpen-Installation", "description": "Installation von Wärmepumpensystemen", "price_from": 5000.0},
                {"title": "Wärmepumpenreparatur", "description": "Reparatur von Wärmepumpensystemen", "price_from": 300.0}
            ],
            "Lüftung": [
                {"title": "Lüftungssystem-Installation", "description": "Installation von Lüftungssystemen", "price_from": 1500.0},
                {"title": "Badezimmer-Lüftung", "description": "Installation von Badezimmer-Abluftventilatoren", "price_from": 300.0}
            ],
            # Handyman subcategories
            "Handwerker:Reparaturen": [
                {"title": "Allgemeine Hausreparaturen", "description": "Verschiedene Hausreparaturaufgaben", "price_from": 100.0},
                {"title": "Gipskartonreparatur", "description": "Reparatur von Löchern und Schäden in Gipskarton", "price_from": 150.0},
                {"title": "Türscharnierreparatur", "description": "Reparatur von Türscharnieren und Ausrichtung", "price_from": 80.0}
            ],
            "Handwerker:Montage": [
                {"title": "Möbelmontage", "description": "Montage von Flachpackmöbeln", "price_from": 80.0},
                {"title": "Gerätemontage", "description": "Montage von Fitnessgeräten und Haushaltsgeräten", "price_from": 100.0},
                {"title": "IKEA-Möbelmontage", "description": "Professionelle IKEA-Möbelmontage", "price_from": 90.0}
            ],
            "Handwerker:Befestigung": [
                {"title": "TV-Montageservice", "description": "Sichere Wandmontage von Fernsehern", "price_from": 120.0},
                {"title": "Regal-Montage", "description": "Montage von Regalen und Wandaufbewahrung", "price_from": 80.0},
                {"title": "Bildaufhängung", "description": "Aufhängen von Bildern und Kunstwerken", "price_from": 50.0}
            ],
            "Handwerker:Installation": [
                {"title": "Geräte-Installation", "description": "Installation von Geschirrspülern, Öfen und Geräten", "price_from": 150.0},
                {"title": "Leuchten-Installation", "description": "Installation von Leuchten und Beschlägen", "price_from": 100.0},
                {"title": "Jalousien-Installation", "description": "Installation von Fensterjalousien und Vorhängen", "price_from": 120.0}
            ],
            "Handwerker:Wartung": [
                {"title": "Hauswartungsservice", "description": "Regelmäßige Hauswartungsaufgaben", "price_from": 120.0},
                {"title": "Saisonale Wartung", "description": "Saisonale Hauswartungs-Checkliste", "price_from": 200.0}
            ],
            "Handwerker:Kleine Arbeiten": [
                {"title": "Schnellreparatur-Service", "description": "Kleine Reparaturarbeiten und schnelle Reparaturen", "price_from": 60.0},
                {"title": "Handwerker-Stundensatz", "description": "Stündlicher Handwerkerservice", "price_from": 50.0}
            ],
            # Car subcategories
            "Auto:Reparaturen": [
                {"title": "Allgemeine Autoreparatur", "description": "Umfassender Autoreparatur- und Wartungsservice", "price_from": 150.0},
                {"title": "Diagnoseservice", "description": "Komplette Fahrzeugdiagnose und Fehlerbehebung", "price_from": 100.0},
                {"title": "Auto-Wartungsservice", "description": "Regelmäßige Wartung und Einstellung", "price_from": 120.0},
                {"title": "Getriebereparatur", "description": "Reparatur und Service von Getriebesystemen", "price_from": 400.0}
            ],
            "Auto:Motor": [
                {"title": "Motordiagnose", "description": "Komplette Motordiagnose und Analyse", "price_from": 150.0},
                {"title": "Motorreparatur-Service", "description": "Reparatur von Motorproblemen und -fehlern", "price_from": 300.0},
                {"title": "Motor-Aufbau", "description": "Kompletter Motor-Aufbau-Service", "price_from": 2000.0},
                {"title": "Zahnriemen-Austausch", "description": "Austausch von Zahnriemen und Wasserpumpe", "price_from": 400.0}
            ],
            "Auto:Bremsen": [
                {"title": "Bremsbelag-Austausch", "description": "Austausch von Bremsbelägen und Scheiben", "price_from": 200.0},
                {"title": "Bremsenservice", "description": "Komplette Bremsenprüfung und Service", "price_from": 150.0},
                {"title": "Bremsflüssigkeitswechsel", "description": "Austausch von Bremsflüssigkeit und Entlüftung der Bremsen", "price_from": 100.0},
                {"title": "Bremscheiben-Austausch", "description": "Austausch abgenutzter Bremscheiben", "price_from": 250.0}
            ],
            "Auto:Reifen": [
                {"title": "Reifenwechsel", "description": "Austausch alter Reifen durch neue", "price_from": 150.0},
                {"title": "Reifenauswuchtung", "description": "Auswuchtung von Reifen für sanftes Fahren", "price_from": 50.0},
                {"title": "Achseinstellung", "description": "Achseinstellung für ordnungsgemäße Handhabung", "price_from": 100.0},
                {"title": "Reifenrotation", "description": "Reifenrotation für gleichmäßigen Verschleiß", "price_from": 40.0}
            ],
            "Auto:Ölwechsel": [
                {"title": "Ölwechsel-Service", "description": "Standard-Öl- und Filterwechsel", "price_from": 60.0},
                {"title": "Vollservice-Ölwechsel", "description": "Ölwechsel mit Flüssigkeitsauffüllung und Inspektion", "price_from": 90.0},
                {"title": "Synthetischer Ölwechsel", "description": "Premium-Synthetiköl-Wechselservice", "price_from": 80.0}
            ],
            "Auto:Batterie": [
                {"title": "Batteriewechsel", "description": "Austausch der Autobatterie", "price_from": 120.0},
                {"title": "Batterietest", "description": "Prüfung der Batteriegesundheit und Ladesystem", "price_from": 30.0},
                {"title": "Batterie-Installation", "description": "Installation neuer Autobatterie", "price_from": 100.0}
            ],
            "Auto:Klimaservice": [
                {"title": "Klimaanlagen-Auffüllservice", "description": "Auffüllung des Autoklimaanlagensystems", "price_from": 150.0},
                {"title": "Klimaanlagenreparatur", "description": "Reparatur von Klimaanlagenproblemen", "price_from": 200.0},
                {"title": "Klimaanlagendiagnose", "description": "Diagnose von Klimaanlagensystemproblemen", "price_from": 100.0}
            ],
            "Auto:Elektrik": [
                {"title": "Elektrikreparatur", "description": "Behebung von Auto-Elektrikproblemen", "price_from": 150.0},
                {"title": "Lichtmaschinenreparatur", "description": "Reparatur oder Austausch der Lichtmaschine", "price_from": 300.0},
                {"title": "Anlasserreparatur", "description": "Reparatur oder Austausch des Anlassers", "price_from": 250.0},
                {"title": "Verkabelungsreparatur", "description": "Reparatur beschädigter elektrischer Verkabelung", "price_from": 200.0}
            ],
            "Auto:Karosserie": [
                {"title": "Dellenentfernung", "description": "Entfernung von Dellen und Restaurierung von Karosserieteilen", "price_from": 200.0},
                {"title": "Karosseriereparatur-Service", "description": "Reparatur von Karosserieschäden und Kratzern", "price_from": 300.0},
                {"title": "Karosserieteil-Austausch", "description": "Austausch beschädigter Karosserieteile", "price_from": 500.0}
            ],
            "Auto:Lackierung": [
                {"title": "Autolackier-Service", "description": "Professionelle Autolackierung und Aufbereitung", "price_from": 800.0},
                {"title": "Teillackierung", "description": "Lackierung einzelner Teile", "price_from": 400.0},
                {"title": "Nachlackierung", "description": "Nachlackierung von Kratzern und Steinschlägen", "price_from": 150.0}
            ],
            "Auto:Aufbereitung": [
                {"title": "Komplett-Autopflege", "description": "Komplette Innen- und Außenpflege", "price_from": 150.0},
                {"title": "Innenpflege", "description": "Grundreinigung des Autoinnenraums", "price_from": 100.0},
                {"title": "Außenpflege", "description": "Politur und Schutz des Äußeren", "price_from": 120.0},
                {"title": "Wachs und Politur", "description": "Professioneller Wachs- und Polierservice", "price_from": 80.0}
            ],
            "Auto:Inspektion": [
                {"title": "Fahrzeuginspektion", "description": "Komplette Fahrzeugsicherheitsinspektion", "price_from": 80.0},
                {"title": "Vorkaufsinspektion", "description": "Fahrzeuginspektion vor dem Kauf", "price_from": 150.0},
                {"title": "Diagnoseinspektion", "description": "Umfassende Diagnoseprüfung", "price_from": 120.0}
            ],
        }
        
        services = []
        for i, (master, profile) in enumerate(master_users):
            # Get subcategory name and parent category name from profile category_id
            subcategory_name = "General"
            parent_category_name = None
            if profile.category_id:
                category_obj = db.query(Category).filter(Category.id == profile.category_id).first()
                if category_obj:
                    subcategory_name = category_obj.name
                    # Get parent category if this is a subcategory
                    if category_obj.parent_id:
                        parent_cat = db.query(Category).filter(Category.id == category_obj.parent_id).first()
                        if parent_cat:
                            parent_category_name = parent_cat.name
            
            # Try to get services from mapping
            # First try composite key (category:subcategory) for duplicate subcategory names
            service_list = []
            if parent_category_name:
                composite_key = f"{parent_category_name}:{subcategory_name}"
                service_list = service_mapping.get(composite_key, [])
            
            # If not found, try subcategory name alone (for unique subcategories)
            if not service_list:
                service_list = service_mapping.get(subcategory_name, [])
            
            # If still no mapping found, use fallback generation
            if not service_list:
                service_list = generate_service_titles(subcategory_name)
            
            # Randomize service selection (3-5 services per master)
            num_services = min(3 + random.randint(0, 2), len(service_list))
            selected_services = random.sample(service_list, num_services) if len(service_list) > num_services else service_list
            
            # Create services for each master
            for idx, service_data in enumerate(selected_services):
                # Approve most services (80% approved, 20% unapproved for moderation demo)
                approved = (idx % 5) != 0  # Every 5th service is unapproved
                # Add slight price variation (±10%)
                price_variation = service_data["price_from"] * (0.9 + random.random() * 0.2)
                service = Service(
                    profile_id=profile.id,
                    title=service_data["title"],
                    description=service_data["description"],
                    price_from=round(price_variation, 2),
                    approved=approved
                )
                db.add(service)
                db.flush()
                services.append(service)
                if i < 10 or idx == 0:  # Only print for first 10 masters or first service
                    status = "approved" if approved else "pending approval"
                    print(f"  ✓ Service created: {service_data['title']} for {master.name} ({status})")
            
            if i > 0 and i % 50 == 0:
                db.commit()
                print(f"  ✓ Created services for {i} masters...")
        
        db.commit()
        print(f"  ✓ Total services created: {len(services)}")
        
        # ============================================
        # 3. PRODUCTS
        # ============================================
        print("\nCreating products...")
        
        # Create products from constant array (23 products)
        products = []
        product_category_ids: list[Optional[int]] = []
        default_product_city_id = _find_city_id(db, "Berlin")
        
        for idx, product_data in enumerate(PRODUCTS_DATA):
            # Find subcategory ID from category structure, ensuring it belongs to the specified category
            category_name = product_data.get("category")
            subcategory_name = product_data["subcategory"]
            subcategory_id = None
            
            # Look up category ID from the map
            subcategory_id = category_id_map.get(CategoryType.product, {}).get(subcategory_name) or category_id_map.get(CategoryType.product, {}).get(subcategory_name.lower())
            
            if not subcategory_id:
                # Fallback: query database directly - MUST be a subcategory (has parent_id)
                category_obj = db.query(Category).filter(
                    Category.name == subcategory_name,
                    Category.type == CategoryType.product,
                    Category.parent_id.isnot(None)  # Ensure it's a subcategory, not a parent
                ).first()
                if category_obj:
                    subcategory_id = category_obj.id
                    category_id_map.setdefault(CategoryType.product, {})[subcategory_name] = subcategory_id
                    category_id_map.setdefault(CategoryType.product, {})[subcategory_name.lower()] = subcategory_id
                else:
                    # Last resort: use first product subcategory
                    first_subcat = db.query(Category).filter(
                        Category.type == CategoryType.product,
                        Category.parent_id.isnot(None)
                    ).first()
                    if first_subcat:
                        subcategory_id = first_subcat.id
                    print(f"  ⚠ Warning: Product {product_data['title']} - subcategory '{subcategory_name}' not found in category '{category_name}', using fallback")
            
            # Get city information (city_id is an ID, city name is used to look it up)
            city_name = product_data.get("city", "Berlin")
            city_id = _find_city_id(db, city_name)
            if not city_id:
                print(f"  ⚠ Warning: City '{city_name}' not found for product {product_data['title']}, using Berlin as fallback")
                city_id = _find_city_id(db, "Berlin")
            
            seller = seller_users[idx % len(seller_users)] if seller_users else None
            if not seller:
                continue
            
            approved = random.random() > 0.15  # 85% approved
            
            product = Product(
                seller_id=seller.id,
                title=product_data["title"],
                description=f"High-quality {subcategory_name.lower()} for professional use. Durable construction and reliable performance.",
                price=product_data["price"],
                stock=product_data["stock"],
                category_id=subcategory_id,
                city_id=city_id,
                brand=product_data.get("brand"),
                rating=round(4.0 + random.random() * 1.0, 2),
                total_reviews=random.randint(0, 30),
                approved=approved
            )
            db.add(product)
            db.flush()
            products.append(product)
            product_category_ids.append(subcategory_id)  # Store ID instead of slug
            
            # Set product image URL
            now = datetime.now()
            image_filename = generate_media_filename(seller.id, "jpeg", meaningful_name=product_data["title"])
            if create_media_files:
                text_label = f"{product_data['title']}\n${product_data['price']:.2f}"
                product.image_url = create_placeholder_image(
                    image_filename,
                    width=800,
                    height=600,
                    text=text_label,
                    media_type="photo",
                    entity_type="product",
                )
            else:
                subfolder = get_media_subfolder("photo", now, entity_type="product")
                product.image_url = build_media_url(subfolder, image_filename)
            
            # Create Media record for main product image
            main_image_media = Media(
                owner_id=product.seller_id,
                product_id=product.id,
                url=product.image_url,
                thumbnail_url=product.image_url,
                media_type="photo",
                status=MediaStatus.approved,
                title=f"{product_data['title']} - Hauptbild",
                description=f"Hauptproduktbild für {product_data['title']}",
                category_id=subcategory_id,
                sort_order=0
            )
            db.add(main_image_media)
        
        db.commit()
        print(f"  ✓ Total products created: {len(products)}")
        
        
        # Add additional product images (2-3 additional images per product)
        print("\nAdding additional product images...")
        for i, product in enumerate(products[:50]):  # Limit to first 50 products for performance
            category_id = product_category_ids[i] if i < len(product_category_ids) else None
            
            # Create 3 additional product images for each product
            additional_product_images = [
                {"text": f"{product.title}\nDetailansicht 1\n${product.price:.2f}", "sort_order": 1, "title_suffix": "Detailansicht 1"},
                {"text": f"{product.title}\nDetailansicht 2\n${product.price:.2f}", "sort_order": 2, "title_suffix": "Detailansicht 2"},
                {"text": f"{product.title}\nIn Verwendung\n${product.price:.2f}", "sort_order": 3, "title_suffix": "In Verwendung"}
            ]
            
            for img_data in additional_product_images:
                # Use human-readable filename format with meaningful name
                now = datetime.now()
                image_filename = generate_media_filename(product.seller_id, "jpeg", meaningful_name=product.title)
                
                if create_media_files:
                    image_url = create_placeholder_image(
                        image_filename,
                        width=800,
                        height=600,
                        text=img_data['text'],
                        media_type="photo",
                        entity_type="product",
                    )
                else:
                    subfolder = get_media_subfolder("photo", now, entity_type="product")
                    image_url = build_media_url(subfolder, image_filename)
                
                # Create Media record for additional product image
                product_media = Media(
                    owner_id=product.seller_id,
                    product_id=product.id,
                    url=image_url,
                    thumbnail_url=image_url,
                    media_type="photo",
                    status=MediaStatus.approved,
                    title=f"{product.title} - {img_data.get('title_suffix', 'Zusätzliches Bild')}",
                    description=f"Zusätzliches Bild von {product.title}",
                    category_id=category_id,
                    sort_order=img_data.get("sort_order", 0)
                )
                db.add(product_media)
                if i < 10:  # Only print for first 10
                    print(f"  ✓ Additional product image added for {product.title}")
        
        db.commit()
        
        # Add 1 video entry for each product (with thumbnail)
        print("\nAdding video entries for products...")
        for i, product in enumerate(products[:50]):  # Limit to first 50 products
            # Use human-readable filename format with meaningful name
            now = datetime.now()
            category_id = product_category_ids[i] if i < len(product_category_ids) else None
            video_filename = generate_media_filename(product.seller_id, "mp4", meaningful_name=f"{product.title} video")
            # Use unique suffix for thumbnail to ensure uniqueness
            thumbnail_filename = generate_media_filename(product.seller_id, "jpeg", meaningful_name=f"{product.title} video thumbnail")
            
            if create_media_files:
                # Create placeholder video file (we'll just create the URL structure)
                video_subfolder = get_media_subfolder("video", now, entity_type="product")
                video_url = build_media_url(video_subfolder, video_filename)
                
                # Create thumbnail image for the video
                text_label = f"{product.title}\nProduktvideo\n{product.price:.2f} €\nVideo-Vorschaubild"
                thumbnail_url = create_placeholder_image(
                    thumbnail_filename,
                    width=1280,
                    height=720,
                    text=text_label,
                    media_type="photo",
                    entity_type="product",
                )
            else:
                # Use structured format for video and thumbnail URLs
                video_subfolder = get_media_subfolder("video", now, entity_type="product")
                photo_subfolder = get_media_subfolder("photo", now, entity_type="product")
                video_url = build_media_url(video_subfolder, video_filename)
                thumbnail_url = build_media_url(photo_subfolder, thumbnail_filename)
            
            # Create video media entry
            product_video = Media(
                owner_id=product.seller_id,
                product_id=product.id,
                url=video_url,
                thumbnail_url=thumbnail_url,
                media_type="video",
                status=MediaStatus.approved,
                title=f"{product.title} - Produkt Video",
                description=f"Produkt demonstration video für {product.title}",
                category_id=category_id,
                sort_order=4  # Video comes after all images
            )
            db.add(product_video)
            if i < 10:  # Only print for first 10
                print(f"  ✓ Video entry created for {product.title}")
        
        db.commit()
        
        # ============================================
        # 4. RENTALS
        # ============================================
        print("\nCreating rentals...")
        
        # Create rentals from constant array (7 rentals)
        rentals = []
        rental_category_ids: list[Optional[int]] = []
        default_rental_city_id = _find_city_id(db, "Berlin")
        
        for idx, rental_data in enumerate(RENTALS_DATA):
            # Find subcategory ID from category structure, ensuring it belongs to the specified category
            category_name = rental_data.get("category")
            subcategory_name = rental_data["subcategory"]
            subcategory_id = None
            
            # Look up category ID from the map
            subcategory_id = category_id_map.get(CategoryType.rental, {}).get(subcategory_name) or category_id_map.get(CategoryType.rental, {}).get(subcategory_name.lower())
            
            if not subcategory_id:
                # Fallback: query database directly - MUST be a subcategory (has parent_id)
                category_obj = db.query(Category).filter(
                    Category.name == subcategory_name,
                    Category.type == CategoryType.rental,
                    Category.parent_id.isnot(None)  # Ensure it's a subcategory, not a parent
                ).first()
                if category_obj:
                    subcategory_id = category_obj.id
                    category_id_map.setdefault(CategoryType.rental, {})[subcategory_name] = subcategory_id
                    category_id_map.setdefault(CategoryType.rental, {})[subcategory_name.lower()] = subcategory_id
                else:
                    # Last resort: use first rental subcategory
                    first_subcat = db.query(Category).filter(
                        Category.type == CategoryType.rental,
                        Category.parent_id.isnot(None)
                    ).first()
                    if first_subcat:
                        subcategory_id = first_subcat.id
                    print(f"  ⚠ Warning: Rental {rental_data['title']} - subcategory '{subcategory_name}' not found in category '{category_name}', using fallback")
            
            # Get city information (city_id is an ID, city name is used to look it up)
            city_name = rental_data.get("city", "Berlin")
            city_id = _find_city_id(db, city_name)
            if not city_id:
                print(f"  ⚠ Warning: City '{city_name}' not found for rental {rental_data['title']}, using Berlin as fallback")
                city_id = _find_city_id(db, "Berlin")
            
            seller = seller_users[idx % len(seller_users)] if seller_users else None
            if not seller:
                continue
            
            approved = random.random() > 0.15  # 85% approved
            rental = Rental(
                seller_id=seller.id,
                title=rental_data["title"],
                description=f"Professional {subcategory_name.lower()} rental equipment. Well-maintained and ready for immediate use.",
                price_per_day=rental_data["price_per_day"],
                stock=rental_data["stock"],
                category_id=subcategory_id,
                city_id=city_id,
                available=rental_data["stock"] > 0,
                approved=approved
            )
            db.add(rental)
            db.flush()
            rentals.append(rental)
            rental_category_ids.append(subcategory_id)  # Store ID instead of slug
            
            # Set rental image URL
            now = datetime.now()
            image_filename = generate_media_filename(seller.id, "jpeg", meaningful_name=rental_data["title"])
            if create_media_files:
                text_label = f"{rental_data['title']}\n${rental_data['price_per_day']:.2f}/Tag"
                rental.image_url = create_placeholder_image(
                    image_filename,
                    width=800,
                    height=600,
                    text=text_label,
                    media_type="photo",
                    entity_type="rental",
                )
            else:
                subfolder = get_media_subfolder("photo", now, entity_type="rental")
                rental.image_url = build_media_url(subfolder, image_filename)
            
            # Create Media record for main rental image
            main_image_media = Media(
                owner_id=rental.seller_id,
                rental_id=rental.id,
                url=rental.image_url,
                thumbnail_url=rental.image_url,
                media_type="photo",
                status=MediaStatus.approved,
                title=f"{rental_data['title']} - Main Image",
                description=f"Main rental image for {rental_data['title']}",
                category_id=subcategory_id,
                sort_order=0
            )
            db.add(main_image_media)
        
        db.commit()
        print(f"  ✓ Total rentals created: {len(rentals)}")
        
        # Add 1 video entry for each rental (with thumbnail)
        print("\nAdding video entries for rentals...")
        for i, rental in enumerate(rentals[:50]):  # Limit to first 50 rentals
            # Use human-readable filename format with meaningful name
            now = datetime.now()
            video_filename = generate_media_filename(rental.seller_id, "mp4", meaningful_name=f"{rental.title} video")
            # Use unique suffix for thumbnail to ensure uniqueness
            thumbnail_filename = generate_media_filename(rental.seller_id, "jpeg", meaningful_name=f"{rental.title} video thumbnail")
            rental_category_id = rental_category_ids[i] if i < len(rental_category_ids) else None
            
            if create_media_files:
                # Create placeholder video file (we'll just create the URL structure)
                video_subfolder = get_media_subfolder("video", now, entity_type="rental")
                video_url = build_media_url(video_subfolder, video_filename)
                
                # Create thumbnail image for the video
                text_label = f"{rental.title}\nMietvideo\n${rental.price_per_day:.2f}/Tag\nVideo-Vorschaubild"
                thumbnail_url = create_placeholder_image(
                    thumbnail_filename,
                    width=1280,
                    height=720,
                    text=text_label,
                    media_type="photo",
                    entity_type="rental",
                )
            else:
                # Use structured format for video and thumbnail URLs
                video_subfolder = get_media_subfolder("video", now, entity_type="rental")
                photo_subfolder = get_media_subfolder("photo", now, entity_type="rental")
                video_url = build_media_url(video_subfolder, video_filename)
                thumbnail_url = build_media_url(photo_subfolder, thumbnail_filename)
            
            # Create video media entry
            rental_video = Media(
                owner_id=rental.seller_id,
                rental_id=rental.id,
                url=video_url,
                thumbnail_url=thumbnail_url,
                media_type="video",
                status=MediaStatus.approved,
                title=f"{rental.title} - Mietvideo",
                description=f"Geräte demonstration video für {rental.title}",
                category_id=rental_category_id,
                sort_order=1  # Video comes after main image
            )
            db.add(rental_video)
            if i < 10:  # Only print for first 10
                print(f"  ✓ Video entry created for {rental.title}")
        
        db.commit()
        
        # ============================================
        # 5. MEDIA (with optional file creation)
        # ============================================
        print("\nCreating media records...")
        media_records = []
        
        # Media for master profiles (work gallery) - using exact original image filenames
        # Create work gallery entries for all masters
        work_gallery_entries = [
            # 0. Thomas Schmidt - Sicherheit
            {
                "master_index": 0,
                "title": "Sicherheitssystem-Installation",
                "description": "Professionelle Schlossinstallation und Einrichtung von Sicherheitssystemen",
                "category": "Schlosserei",
                "before_image": "old-lock-before",
                "after_image": "modern-security-after",
                "is_before_after": True
            },
            # 1. Anna Müller - Malerei
            {
                "master_index": 1,
                "title": "Innenraum-Malerei-Transformation",
                "description": "Komplette Innenraum-Malerei-Transformation",
                "category": "Innen",
                "before_image": "dull-room-before",
                "after_image": "vibrant-room-after",
                "is_before_after": True
            },
            # 2. Maria Schneider - Reinigung
            {
                "master_index": 2,
                "title": "Grundreinigungsservice",
                "description": "Professioneller Grundreinigungsservice für Wohnungen und Büros",
                "category": "Grundreinigung",
                "before_image": "messy-space-before",
                "after_image": "spotless-space-after",
                "is_before_after": True
            },
            # 3. Michael Fischer - Sanitär
            {
                "master_index": 3,
                "title": "Badezimmer-Renovierung",
                "description": "Komplette Badezimmer-Renovierung",
                "category": "Installation",
                "before_image": "old-bathroom-before",
                "after_image": "modern-bathroom-after",
                "is_before_after": True
            },
            # 4. Andreas Richter - Dachdecker
            {
                "master_index": 4,
                "title": "Dachrestaurierung",
                "description": "Komplette Dachrestaurierung und Reparatur",
                "category": "Reparaturen",
                "before_image": "damaged-roof-before",
                "after_image": "restored-roof-after",
                "is_before_after": True
            },
            # 5. Stefan Wagner - Schreinerei
            {
                "master_index": 5,
                "title": "Küchen-Renovierung",
                "description": "Komplette Küchen-Renovierung",
                "category": "Möbel",
                "before_image": "old-kitchen-before",
                "after_image": "modern-kitchen-after",
                "is_before_after": True
            },
            # 6. Petra Becker - Fliesen
            {
                "master_index": 6,
                "title": "Badezimmer-Fliesen-Installation",
                "description": "Professionelle Flieseninstallation für Badezimmer",
                "category": "Badezimmer",
                "before_image": "old-tiles-before",
                "after_image": "new-tiles-after",
                "is_before_after": True
            },
            # 7. Sabine Hoffmann - Malerei
            {
                "master_index": 7,
                "title": "Wohnzimmer-Transformation",
                "description": "Komplette Inneneinrichtungs-Transformation",
                "category": "Gewerblich",
                "before_image": "plain-room-before",
                "after_image": "designed-room-after",
                "is_before_after": True
            },
            # Zusätzliche Vorher-Nachher-Beispiele
            # 8. Thomas Schmidt - Sicherheit (2. Beispiel)
            {
                "master_index": 0,
                "title": "Türschloss-Upgrade",
                "description": "Moderne Smart-Lock-Installation",
                "category": "Schlosserei",
                "before_image": "traditional-lock-before",
                "after_image": "smart-lock-after",
                "is_before_after": True
            },
            # 9. Anna Müller - Malerei (2. Beispiel)
            {
                "master_index": 1,
                "title": "Außenanstrich-Projekt",
                "description": "Kompletter Außenanstrich des Hauses",
                "category": "Außen",
                "before_image": "faded-exterior-before",
                "after_image": "fresh-exterior-after",
                "is_before_after": True
            },
            # 10. Klaus Weber - Auto Reparaturen
            {
                "master_index": 8,
                "title": "Motorreparatur-Service",
                "description": "Kompletter Motor-Diagnose- und Reparaturservice",
                "category": "Reparaturen",
                "before_image": "broken-engine-before",
                "after_image": "repaired-engine-after",
                "is_before_after": True
            },
            # 11. Hans Bauer - Auto Motor
            {
                "master_index": 9,
                "title": "Motor-Aufbau-Projekt",
                "description": "Kompletter Motor-Aufbau und Restaurierung",
                "category": "Motor",
                "before_image": "worn-engine-before",
                "after_image": "rebuilt-engine-after",
                "is_before_after": True
            },
            # 12. Peter Koch - Auto Bremsen
            {
                "master_index": 10,
                "title": "Bremsanlage-Überholung",
                "description": "Kompletter Austausch von Bremsbelägen und Scheiben",
                "category": "Bremsen",
                "before_image": "worn-brakes-before",
                "after_image": "new-brakes-after",
                "is_before_after": True
            },
        ]
        
        # Create work gallery entries for all masters
        for entry in work_gallery_entries:
            if entry["master_index"] < len(master_users):
                master, profile = master_users[entry["master_index"]]
                
                category_name = entry.get("category")
                category_id = None
                if category_name:
                    # Look up category ID from the map
                    category_id = category_id_map.get(CategoryType.master, {}).get(category_name) or category_id_map.get(CategoryType.master, {}).get(category_name.lower())
                    if not category_id:
                        # Fallback: query database directly
                        category_obj = db.query(Category).filter(
                            Category.name == category_name,
                            Category.type == CategoryType.master
                        ).first()
                        if category_obj:
                            category_id = category_obj.id
                
                if entry.get("is_before_after", False):
                    # Before/After pair - use human-readable filename format
                    now = datetime.now()
                    entry_title = entry.get("title", "work")
                    before_filename = generate_media_filename(master.id, "jpeg", meaningful_name=f"{entry_title} before")
                    # Use unique suffix for after image to ensure uniqueness
                    after_filename = generate_media_filename(master.id, "jpeg", meaningful_name=f"{entry_title} after")
                    
                    if create_media_files:
                        # Create the actual image files
                        before_url = create_placeholder_image(
                            before_filename,
                            width=1200,
                            height=800,
                            text=f"{entry['title']}\nVorher",
                            media_type="photo",
                            entity_type="master",
                        )
                        after_url = create_placeholder_image(
                            after_filename,
                            width=1200,
                            height=800,
                            text=f"{entry['title']}\nNachher",
                            media_type="photo",
                            entity_type="master",
                        )
                    else:
                        # Use structured format for image URLs
                        subfolder = get_media_subfolder("photo", now, entity_type="master")
                        before_url = build_media_url(subfolder, before_filename)
                        after_url = build_media_url(subfolder, after_filename)
                    
                    media = Media(
                        owner_id=master.id,
                        profile_id=profile.id,
                        url=after_url,
                        thumbnail_url=after_url,
                        media_type="photo",
                        status=MediaStatus.approved,
                        title=entry["title"],
                        description=entry["description"],
                        category_id=category_id,
                        is_before_after=True,
                        before_url=before_url,
                        after_url=after_url
                    )
                else:
                    # Single image - use human-readable filename format
                    now = datetime.now()
                    entry_title = entry.get("title", "work")
                    image_filename = generate_media_filename(master.id, "jpeg", meaningful_name=entry_title)
                    
                    if create_media_files:
                        # Create the actual image file
                        text_label = f"{entry['title']}\n{entry['category']}"
                        media_url = create_placeholder_image(
                            image_filename,
                            width=1200,
                            height=800,
                            text=text_label,
                            media_type="photo",
                            entity_type="master",
                        )
                    else:
                        # Use structured format for image URL
                        subfolder = get_media_subfolder("photo", now, entity_type="master")
                        media_url = build_media_url(subfolder, image_filename)
                    
                    media = Media(
                        owner_id=master.id,
                        profile_id=profile.id,
                        url=media_url,
                        thumbnail_url=media_url,
                        media_type="photo",
                        status=MediaStatus.approved,
                        title=entry["title"],
                        description=entry["description"],
                        category_id=category_id,
                        is_before_after=False
                    )
                
                db.add(media)
                db.flush()
                media_records.append(media)
                print(f"  ✓ Work gallery entry created for {master.name} ({entry['category']})")
        
        db.commit()
        
        # Add additional work gallery entries for each master (2-3 additional entries per master)
        print("\nAdding additional work gallery entries for masters...")
        for i, (master, profile) in enumerate(master_users):
            # Use profile category_id for work gallery
            category_name = "General"
            if profile.category_id:
                category_obj = db.query(Category).filter(Category.id == profile.category_id).first()
                if category_obj:
                    category_name = category_obj.name
            
            # Create 3 additional work gallery entries for each master
            additional_work_entries = [
                {
                    "title": f"{category_name} Project",
                    "description": f"Additional {category_name.lower()} work showcase",
                    "category": category_name,
                    "image": f"{category_name.lower()}-work-gallery-1",
                    "is_before_after": False
                },
                {
                    "title": f"{category_name} Service",
                    "description": f"Professional {category_name.lower()} service demonstration",
                    "category": category_name,
                    "image": f"{category_name.lower()}-work-gallery-2",
                    "is_before_after": False
                },
                {
                    "title": f"{category_name} Completion",
                    "description": f"Completed {category_name.lower()} project",
                    "category": category_name,
                    "image": f"{category_name.lower()}-work-gallery-3",
                    "is_before_after": False
                }
            ]
            
            for entry_data in additional_work_entries:
                # Use human-readable filename format with meaningful name
                now = datetime.now()
                entry_title = entry_data.get("title", "work")
                image_filename = generate_media_filename(master.id, "jpeg", meaningful_name=entry_title)
                entry_category_name = entry_data.get("category", category_name)
                # Look up category_id from category name
                entry_category_id = None
                if entry_category_name:
                    entry_category_obj = db.query(Category).filter(
                        Category.name == entry_category_name,
                        Category.type == CategoryType.master
                    ).first()
                    if entry_category_obj:
                        entry_category_id = entry_category_obj.id
                    else:
                        # Fallback to profile's category_id
                        entry_category_id = profile.category_id
                
                if create_media_files:
                    text_label = f"{entry_data['title']}\n{entry_data['category']}"
                    media_url = create_placeholder_image(
                        image_filename,
                        width=1200,
                        height=800,
                        text=text_label,
                        media_type="photo",
                        entity_type="master",
                    )
                else:
                    subfolder = get_media_subfolder("photo", now, entity_type="master")
                    media_url = build_media_url(subfolder, image_filename)
                
                media = Media(
                    owner_id=master.id,
                    profile_id=profile.id,
                    url=media_url,
                    thumbnail_url=media_url,
                    media_type="photo",
                    status=MediaStatus.approved,
                    title=entry_data["title"],
                    description=entry_data["description"],
                    category_id=entry_category_id,
                    is_before_after=False
                )
                db.add(media)
                db.flush()
                media_records.append(media)
                print(f"  ✓ Additional work gallery entry created for {master.name} ({entry_data['category']})")
        
        db.commit()
        
        # Add 1 video entry for each master (with thumbnail)
        print("\nAdding video entries for masters...")
        for i, (master, profile) in enumerate(master_users):
            # Use profile category_id for work gallery
            category_id = profile.category_id
            category_name = "General"
            if category_id:
                category_obj = db.query(Category).filter(Category.id == category_id).first()
                if category_obj:
                    category_name = category_obj.name
            
            # Create video entry - use human-readable filename format
            now = datetime.now()
            video_filename = generate_media_filename(master.id, "mp4", meaningful_name=f"{master.name} {category_name} video")
            # Use unique suffix for thumbnail to ensure uniqueness
            thumbnail_filename = generate_media_filename(master.id, "jpeg", meaningful_name=f"{master.name} {category_name} video thumbnail")
            
            if create_media_files:
                # Create placeholder video file (we'll just create the URL structure)
                # In production, this would be an actual video file
                video_subfolder = get_media_subfolder("video", now, entity_type="master")
                video_url = build_media_url(video_subfolder, video_filename)
                
                # Create thumbnail image for the video
                text_label = f"{category_name} Arbeitsvideo\n{master.name}\nVideo-Vorschaubild"
                thumbnail_url = create_placeholder_image(
                    thumbnail_filename,
                    width=1280,
                    height=720,
                    text=text_label,
                    media_type="photo",
                    entity_type="master",
                )
            else:
                # Use structured format for video and thumbnail URLs
                video_subfolder = get_media_subfolder("video", now, entity_type="master")
                photo_subfolder = get_media_subfolder("photo", now, entity_type="master")
                video_url = build_media_url(video_subfolder, video_filename)
                thumbnail_url = build_media_url(photo_subfolder, thumbnail_filename)
            
            # Create video media entry
            video_media = Media(
                owner_id=master.id,
                profile_id=profile.id,
                url=video_url,
                thumbnail_url=thumbnail_url,
                media_type="video",
                status=MediaStatus.approved,
                title=f"{category_name} Arbeitsvideo",
                description=f"Professionelles {category_name.lower()}-Arbeitsdemonstrationsvideo",
                category_id=category_id,
                is_before_after=False
            )
            db.add(video_media)
            db.flush()
            media_records.append(video_media)
            print(f"  ✓ Video entry created for {master.name} ({category_name})")
        
        db.commit()
        print(f"  ✓ Created {len(media_records)} media records")
        
        # ============================================
        # 6. ORDERS
        # ============================================
        print("\nCreating orders...")
        orders = []
        
        primary_master_id = master_users[0][0].id if master_users else None
        primary_product_id = products[0].id if products else None

        # Service orders - create realistic booking data with varied statuses
        print("Creating service orders...")
        if not client_users:
            print("  ! Skipping service orders: no client users available.")
        else:
            order_statuses = [OrderStatus.created, OrderStatus.paid, OrderStatus.completed, OrderStatus.canceled]
            status_weights = [0.2, 0.2, 0.5, 0.1]  # More completed orders
            
            for i, (master, profile) in enumerate(master_users):  # All masters
                master_services = [s for s in services if s.profile_id == profile.id]
                if not master_services:
                    continue

                # Create 2-5 orders per master with varied statuses
                num_orders = random.randint(2, 5)
                for j in range(num_orders):
                    service = random.choice(master_services)
                    client = random.choice(client_users)
                    
                    # Weighted random status selection
                    status = random.choices(order_statuses, weights=status_weights)[0]
                    base_price = service.price_from or 100.0
                    amount = round(base_price * (1.0 + random.random() * 0.5), 2)
                    commission = round(amount * 0.1, 2)
                    
                    # Set dates based on status
                    if status == OrderStatus.completed:
                        completed_at = utcnow() - timedelta(days=random.randint(1, 60))
                    else:
                        completed_at = None
                    
                    city_name = profile.city_ref.name if getattr(profile, 'city_ref', None) else 'Unknown'
                    order = Order(
                        buyer_id=client.id,
                        seller_id=master.id,
                        service_id=service.id,
                        order_type=OrderType.service,
                        status=status,
                        amount=amount,
                        commission=commission,
                        location=f"{city_name}, Germany",
                        notes=random.choice([
                            f"Great {service.title.lower()} service!",
                            f"Professional work, very satisfied.",
                            f"Would hire again.",
                            f"Excellent quality and communication.",
                            f"On-time completion, highly recommended."
                        ]),
                        completed_at=completed_at,
                        created_at=utcnow() - timedelta(days=random.randint(1, 90))
                    )
                    db.add(order)
                    db.flush()
                    orders.append(order)
                
                if i > 0 and i % 20 == 0:
                    db.commit()
                    print(f"  ✓ Created orders for {i} masters...")
            
            db.commit()
        
        # Product orders - create realistic purchase data
        print("Creating product orders...")
        if not client_users:
            print("  ! Skipping product orders: no client users available.")
        else:
            order_statuses = [OrderStatus.created, OrderStatus.paid, OrderStatus.completed, OrderStatus.canceled]
            status_weights = [0.2, 0.2, 0.5, 0.1]  # More completed orders
            
            for i, product in enumerate(products):  # All products
                num_orders = random.randint(1, 3)
                for j in range(num_orders):
                    client = random.choice(client_users)
                    status = random.choices(order_statuses, weights=status_weights)[0]
                    
                    if status == OrderStatus.completed:
                        completed_at = utcnow() - timedelta(days=random.randint(1, 45))
                    else:
                        completed_at = None
                    
                    order = Order(
                        buyer_id=client.id,
                        seller_id=product.seller_id,
                        product_id=product.id,
                        order_type=OrderType.product,
                        status=status,
                        amount=product.price,
                        commission=round(product.price * 0.1, 2),
                        notes=random.choice([
                            "Fast shipping!",
                            "Great product quality.",
                            "Exactly as described.",
                            "Good value for money.",
                            "Would recommend to others."
                        ]),
                        completed_at=completed_at,
                        created_at=utcnow() - timedelta(days=random.randint(1, 60))
                    )
                    db.add(order)
                    db.flush()
                    orders.append(order)
                
                if i > 0 and i % 50 == 0:
                    db.commit()
                    print(f"  ✓ Created orders for {i} products...")
            
            db.commit()
        
        # Rental orders - create realistic rental bookings
        print("Creating rental orders...")
        if not client_users:
            print("  ! Skipping rental orders: no client users available.")
        else:
            order_statuses = [OrderStatus.created, OrderStatus.paid, OrderStatus.completed, OrderStatus.canceled]
            status_weights = [0.2, 0.2, 0.5, 0.1]  # More completed orders
            
            for i, rental in enumerate(rentals):  # All rentals
                num_orders = random.randint(1, 3)
                for j in range(num_orders):
                    client = random.choice(client_users)
                    status = random.choices(order_statuses, weights=status_weights)[0]
                    rental_days = random.randint(1, 7)
                    amount = round(rental.price_per_day * rental_days, 2)
                    
                    if status == OrderStatus.completed:
                        completed_at = utcnow() - timedelta(days=random.randint(1, 30))
                    else:
                        completed_at = None
                    
                    order = Order(
                        buyer_id=client.id,
                        seller_id=rental.seller_id,
                        rental_id=rental.id,
                        order_type=OrderType.rental,
                        status=status,
                        amount=amount,
                        commission=round(amount * 0.1, 2),
                        notes=random.choice([
                            f"Rented for {rental_days} day(s). Equipment in excellent condition.",
                            f"Great rental experience. {rental_days} day rental.",
                            f"Equipment worked perfectly for {rental_days} days.",
                            f"Smooth pickup and return process.",
                            f"Would rent again. {rental_days} day rental period."
                        ]),
                        completed_at=completed_at,
                        created_at=utcnow() - timedelta(days=random.randint(1, 45))
                    )
                    db.add(order)
                    db.flush()
                    orders.append(order)
                
                if i > 0 and i % 50 == 0:
                    db.commit()
                    print(f"  ✓ Created orders for {i} rentals...")
            
            db.commit()
        print(f"  ✓ Total orders created: {len(orders)}")
        
        # ============================================
        # 7. REVIEWS
        # ============================================
        print("\nCreating reviews...")
        
        # Review texts for different types
        service_review_texts = [
            "Ausgezeichneter Service! Sehr empfehlenswert.",
            "Professionelle Arbeit, sehr zufrieden mit dem Ergebnis.",
            "Großartige Kommunikation und qualitativ hochwertige Arbeit.",
            "Würde auf jeden Fall wieder beauftragen. Top Service!",
            "Sehr professionell und pünktlich. Ausgezeichnete Ergebnisse.",
            "Hervorragende Handwerkskunst und Liebe zum Detail.",
            "Großartige Erfahrung von Anfang bis Ende.",
            "Hochqualifizierter Profi. Sehr zufrieden mit der Arbeit."
        ]
        
        product_review_texts = [
            "Tolles Produkt, genau wie beschrieben!",
            "Schneller Versand und gute Qualität.",
            "Sehr zufrieden mit diesem Kauf.",
            "Gutes Preis-Leistungs-Verhältnis. Empfohlen!",
            "Produkt kam schnell an und funktioniert perfekt.",
            "Ausgezeichnete Qualität, würde wieder kaufen.",
            "Tolles Produkt, hat alle Erwartungen erfüllt.",
            "Schnelle Lieferung und gute Verpackung."
        ]
        
        rental_review_texts = [
            "Miet-Erfahrung war reibungslos und einfach.",
            "Gerät hat während der gesamten Mietdauer perfekt funktioniert.",
            "Großartiger Miet-Service, alles wie vereinbart.",
            "Freundliche Übergabe und gut gewartete Ausrüstung.",
            "Würde wieder mieten, sehr zuverlässig.",
            "Gute Kommunikation und flexible Abholzeiten.",
            "Keine Probleme während der Mietdauer, empfohlen.",
            "Günstige Miete mit erstklassiger Ausrüstung."
        ]
        
        if not client_users:
            print("  ! Skipping review creation: no client users available.")
        else:
            total_reviews_created = 0
            
            # Rating distribution: 70% are 4-5 stars (positive), 25% are 3 stars (neutral), 5% are 1-2 stars (negative)
            rating_weights = [0.02, 0.03, 0.25, 0.35, 0.35]  # Weights for 1, 2, 3, 4, 5 stars
            rating_values = [1, 2, 3, 4, 5]
            
            # Create reviews for masters (3-10 reviews per master)
            print("Creating reviews for masters...")
            for master, profile in master_users:
                # Get completed orders for this master's services
                master_services = [s for s in services if s.profile_id == profile.id]
                if not master_services:
                    continue
                
                service_ids = [s.id for s in master_services]
                completed_orders = (
                    db.query(Order)
                    .filter(
                        Order.status == OrderStatus.completed,
                        Order.service_id.in_(service_ids),
                        Order.seller_id == master.id
                    )
                    .outerjoin(Review, Order.id == Review.order_id)
                    .filter(Review.id.is_(None))
                    .all()
                )
                
                if not completed_orders:
                    continue
                
                # Select 3-10 orders for review (or all if less than 3)
                num_reviews = random.randint(3, 10)
                orders_to_review = random.sample(completed_orders, min(num_reviews, len(completed_orders)))
                
                for order in orders_to_review:
                    review_text = random.choice(service_review_texts)
                    rating = random.choices(rating_values, weights=rating_weights)[0]
                    
                    review = Review(
                        order_id=order.id,
                        rating=rating,
                        text=review_text
                    )
                    db.add(review)
                    total_reviews_created += 1
                
                print(f"  ✓ Created {len(orders_to_review)} review(s) for master {master.name}")
            
            # Create reviews for products (3-10 reviews per product)
            print("Creating reviews for products...")
            for product in products:
                # Get completed orders for this product
                completed_orders = (
                    db.query(Order)
                    .filter(
                        Order.status == OrderStatus.completed,
                        Order.product_id == product.id
                    )
                    .outerjoin(Review, Order.id == Review.order_id)
                    .filter(Review.id.is_(None))
                    .all()
                )
                
                if not completed_orders:
                    continue
                
                # Select 3-10 orders for review (or all if less than 3)
                num_reviews = random.randint(3, 10)
                orders_to_review = random.sample(completed_orders, min(num_reviews, len(completed_orders)))
                
                for order in orders_to_review:
                    review_text = random.choice(product_review_texts)
                    rating = random.choices(rating_values, weights=rating_weights)[0]
                    
                    review = Review(
                        order_id=order.id,
                        rating=rating,
                        text=review_text
                    )
                    db.add(review)
                    total_reviews_created += 1
                
                print(f"  ✓ Created {len(orders_to_review)} review(s) for product {product.title}")
            
            # Create reviews for rentals (3-10 reviews per rental)
            print("Creating reviews for rentals...")
            for rental in rentals:
                # Get completed orders for this rental
                completed_orders = (
                    db.query(Order)
                    .filter(
                        Order.status == OrderStatus.completed,
                        Order.rental_id == rental.id
                    )
                    .outerjoin(Review, Order.id == Review.order_id)
                    .filter(Review.id.is_(None))
                    .all()
                )
                
                if not completed_orders:
                    continue
                
                # Select 3-10 orders for review (or all if less than 3)
                num_reviews = random.randint(3, 10)
                orders_to_review = random.sample(completed_orders, min(num_reviews, len(completed_orders)))
                
                for order in orders_to_review:
                    review_text = random.choice(rental_review_texts)
                    rating = random.choices(rating_values, weights=rating_weights)[0]
                    
                    review = Review(
                        order_id=order.id,
                        rating=rating,
                        text=review_text
                    )
                    db.add(review)
                    total_reviews_created += 1
                
                print(f"  ✓ Created {len(orders_to_review)} review(s) for rental {rental.title}")
            
            print(f"  ✓ Total reviews created: {total_reviews_created}")
        
        db.commit()
        
        # Update aggregate ratings based on created reviews
        print("\nUpdating aggregate ratings...")
        
        # Refresh master ratings from reviews
        master_profiles = (
            db.query(Profile)
            .join(User)
            .filter(User.role == Role.master)
            .all()
        )
        for profile in master_profiles:
            review_stats = (
                db.query(func.avg(Review.rating), func.count(Review.id))
                .join(Order, Review.order_id == Order.id)
                .filter(Order.seller_id == profile.user_id)
                .filter(Order.status == OrderStatus.completed)
                .first()
            )
            if review_stats and review_stats[1]:
                avg_rating, review_count = review_stats
                profile.rating = round(float(avg_rating), 2)
                profile.total_reviews = int(review_count)
            else:
                profile.rating = 0.0
                profile.total_reviews = 0
        
        # Refresh product ratings from reviews
        product_stats = (
            db.query(Product.id, func.avg(Review.rating), func.count(Review.id))
            .join(Order, Order.product_id == Product.id)
            .join(Review, Review.order_id == Order.id)
            .filter(Order.status == OrderStatus.completed)
            .group_by(Product.id)
            .all()
        )
        reviewed_product_ids = set()
        for product_id, avg_rating, review_count in product_stats:
            product = db.get(Product, product_id)
            if product:
                product.rating = round(float(avg_rating), 2)
                product.total_reviews = int(review_count)
                reviewed_product_ids.add(product_id)
        if product_stats:
            db.query(Product).filter(Product.id.notin_(reviewed_product_ids)).update(
                {Product.rating: 0.0, Product.total_reviews: 0},
                synchronize_session=False,
            )
        else:
            db.query(Product).update({Product.rating: 0.0, Product.total_reviews: 0})
        
        db.commit()
        
        # ============================================
        # 8.5. BLOCKED USERS
        # ============================================
        print("\nCreating blocked user samples...")
        if master_users and client_users:
            blocker_user = master_users[0][0]
            blocked_user = client_users[-1]
            block_exists = db.query(BlockedUser).filter(
                BlockedUser.blocker_id == blocker_user.id,
                BlockedUser.blocked_id == blocked_user.id,
            ).first()
            if not block_exists:
                block_record = BlockedUser(
                    blocker_id=blocker_user.id,
                    blocked_id=blocked_user.id,
                )
                db.add(block_record)
                print(f"  ✓ {blocker_user.name} blocked {blocked_user.name}")
            else:
                print("  ↺ Sample block already present")
        else:
            print("  ! Skipping blocked users; insufficient sample users")
        
        db.commit()
        
        # ============================================
        # 9. AVAILABILITY SLOTS
        # ============================================
        print("\nCreating availability slots...")
        for master, profile in master_users:
            base_day = utcnow()
            for day in range(7):
                slot_start = (base_day + timedelta(days=day)).replace(hour=9, minute=0, second=0, microsecond=0)
                slot_end = slot_start.replace(hour=17, minute=0, second=0, microsecond=0)
                slot = AvailabilitySlot(
                    profile_id=profile.id,
                    start_time=slot_start,
                    end_time=slot_end,
                    is_available=True
                )
                db.add(slot)
            print(f"  ✓ Availability slots created for {master.name}")
        
        db.commit()
        
        # ============================================
        # 10. PROMOTIONS
        # ============================================
        print("\nCreating promotions...")
        for master, profile in master_users[:2]:
            now_utc = utcnow()
            promotion = Promotion(
                profile_id=profile.id,
                start_date=now_utc,
                end_date=now_utc + timedelta(days=30),
                is_active=True
            )
            db.add(promotion)
            print(f"  ✓ Promotion created for {master.name}")
        
        db.commit()
        
        # ============================================
        # 11. FAVORITES
        # ============================================
        print("\nCreating favorites...")

        favorites_created = 0
        favorite_pairs = set()
        type_counts = {"profile": 0, "product": 0, "rental": 0}

        def add_favorite(user, favorite_type, favorite_id):
            nonlocal favorites_created
            key = (user.id, favorite_type, favorite_id)
            if key in favorite_pairs:
                return
            favorite_pairs.add(key)
            db.add(
                Favorite(
                    user_id=user.id,
                    favorite_type=favorite_type,
                    favorite_id=favorite_id,
                )
            )
            favorites_created += 1
            type_counts[favorite_type] = type_counts.get(favorite_type, 0) + 1

        def deduplicate_users(users):
            seen = set()
            unique = []
            for user in users:
                if user.id in seen:
                    continue
                seen.add(user.id)
                unique.append(user)
            return unique

        follower_pool = deduplicate_users(
            client_users
            + seller_users[:5]
            + [master_user for master_user, _ in master_users[:3]]
        )

        if follower_pool and master_users:
            master_profiles = [profile for _, profile in master_users]
            for idx, profile in enumerate(master_profiles[:6]):
                target_count = max(len(follower_pool) - idx, 0)
                if target_count <= 0:
                    break
                for user in follower_pool[:target_count]:
                    add_favorite(user, "profile", profile.id)

        if follower_pool and products:
            product_followers = deduplicate_users(
                follower_pool + [master_user for master_user, _ in master_users[:2]]
            )
            for idx, product in enumerate(products[:8]):
                target_count = max(len(product_followers) - idx // 2, 0)
                if target_count <= 0:
                    break
                for user in product_followers[:target_count]:
                    add_favorite(user, "product", product.id)

        if follower_pool and rentals:
            rental_followers = deduplicate_users(
                follower_pool + [master_user for master_user, _ in master_users[2:5]]
            )
            for idx, rental in enumerate(rentals[:6]):
                target_count = max(len(rental_followers) - (idx // 2 + 1), 0)
                if target_count <= 0:
                    break
                for user in rental_followers[:target_count]:
                    add_favorite(user, "rental", rental.id)

        if type_counts["profile"] == 0 and client_users and master_users:
            add_favorite(client_users[0], "profile", master_users[0][1].id)

        if type_counts["product"] == 0 and follower_pool and products:
            add_favorite(follower_pool[0], "product", products[0].id)

        if type_counts["rental"] == 0 and follower_pool and rentals:
            add_favorite(follower_pool[0], "rental", rentals[0].id)

        print(f"  ✓ Favorites created ({favorites_created} records)")
        
        db.commit()
        
        # ============================================
        # 12. NOTIFICATIONS
        # ============================================
        ensure_featured_selections(db, master_users, products, rentals)
        seed_item_relationships(
            db,
            master_users,
            products,
            rentals,
            created_by=admin.id if admin else None,
        )
        seed_recently_viewed_items(db, client_users, master_users, products, rentals)
        
        print("\nCreating notifications...")
        for client in client_users:
            notification = Notification(
                user_id=client.id,
                type="order",
                title="Order Confirmed",
                message="Your order has been confirmed",
                is_read=False,
                related_id=orders[0].id if orders else None
            )
            db.add(notification)
        
        print(f"  ✓ Notifications created")
        
        db.commit()
        
        print("\n" + "="*60)
        print("Database seeding completed successfully!")
        print("="*60)
        print("\nDefault credentials:")
        print("  Admin: admin@allesinda.io / admin123")
        print("\nMasters:")
        for i, (master, profile) in enumerate(master_users[:8]):
            print(f"  {master.name}: {master.email} / password123")
        print("\nSellers:")
        for i, seller in enumerate(seller_users[:10]):
            print(f"  {seller.name}: {seller.email} / password123")
        print("\nClients:")
        for i, client in enumerate(client_users[:5]):
            print(f"  {client.name}: {client.email} / password123")
        print("\nAll users use password: password123")

def main():
    """Main entry point"""
    import argparse
    parser = argparse.ArgumentParser(description="Seed database with sample data")
    parser.add_argument(
        "--create-media-files",
        action="store_true",
        help="Create actual placeholder image files (requires PIL/Pillow)"
    )
    args = parser.parse_args()
    
    try:
        seed_database(create_media_files=args.create_media_files)
    except Exception as e:
        print(f"Error seeding database: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()

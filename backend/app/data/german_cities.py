"""
Top 80 German cities by population.
id matches frontend and API city_id (1–80).
"""
from typing import List, Optional, Tuple

CITY_T = Tuple[int, str]

GERMAN_CITIES: List[CITY_T] = [
    (1, "Berlin"),
    (2, "Hamburg"),
    (3, "München"),
    (4, "Köln"),
    (5, "Frankfurt am Main"),
    (6, "Stuttgart"),
    (7, "Düsseldorf"),
    (8, "Leipzig"),
    (9, "Dortmund"),
    (10, "Essen"),
    (11, "Bremen"),
    (12, "Dresden"),
    (13, "Hannover"),
    (14, "Nürnberg"),
    (15, "Duisburg"),
    (16, "Bochum"),
    (17, "Wuppertal"),
    (18, "Bielefeld"),
    (19, "Bonn"),
    (20, "Mannheim"),
    (21, "Karlsruhe"),
    (22, "Wiesbaden"),
    (23, "Münster"),
    (24, "Augsburg"),
    (25, "Mönchengladbach"),
    (26, "Gelsenkirchen"),
    (27, "Aachen"),
    (28, "Braunschweig"),
    (29, "Chemnitz"),
    (30, "Kiel"),
    (31, "Halle (Saale)"),
    (32, "Magdeburg"),
    (33, "Freiburg im Breisgau"),
    (34, "Krefeld"),
    (35, "Lübeck"),
    (36, "Oberhausen"),
    (37, "Erfurt"),
    (38, "Mainz"),
    (39, "Rostock"),
    (40, "Kassel"),
    (41, "Hagen"),
    (42, "Hamm"),
    (43, "Saarbrücken"),
    (44, "Herne"),
    (45, "Mülheim an der Ruhr"),
    (46, "Potsdam"),
    (47, "Ludwigshafen am Rhein"),
    (48, "Oldenburg"),
    (49, "Leverkusen"),
    (50, "Osnabrück"),
    (51, "Solingen"),
    (52, "Heidelberg"),
    (53, "Darmstadt"),
    (54, "Paderborn"),
    (55, "Regensburg"),
    (56, "Ingolstadt"),
    (57, "Würzburg"),
    (58, "Fürth"),
    (59, "Wolfsburg"),
    (60, "Offenbach am Main"),
    (61, "Ulm"),
    (62, "Heilbronn"),
    (63, "Pforzheim"),
    (64, "Göttingen"),
    (65, "Bottrop"),
    (66, "Trier"),
    (67, "Recklinghausen"),
    (68, "Reutlingen"),
    (69, "Bremerhaven"),
    (70, "Koblenz"),
    (71, "Bergisch Gladbach"),
    (72, "Jena"),
    (73, "Remscheid"),
    (74, "Erlangen"),
    (75, "Moers"),
    (76, "Siegen"),
    (77, "Hildesheim"),
    (78, "Salzgitter"),
    (79, "Cottbus"),
    (80, "Gütersloh"),
]


def get_cities_list() -> List[dict]:
    """Return cities as list of dicts for API: [{"id": 1, "name": "Berlin"}, ...]."""
    return [{"id": cid, "name": name} for cid, name in GERMAN_CITIES]


def get_city_by_id(city_id: int) -> Optional[str]:
    """Return city name by id or None."""
    for cid, name in GERMAN_CITIES:
        if cid == city_id:
            return name
    return None

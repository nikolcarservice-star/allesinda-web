/**
 * Top 80 German cities by population (for search, signup, filters).
 * id matches backend city_id (1–80).
 */
export interface City {
  id: number
  name: string
}

export const GERMAN_CITIES: City[] = [
  { id: 1, name: "Berlin" },
  { id: 2, name: "Hamburg" },
  { id: 3, name: "München" },
  { id: 4, name: "Köln" },
  { id: 5, name: "Frankfurt am Main" },
  { id: 6, name: "Stuttgart" },
  { id: 7, name: "Düsseldorf" },
  { id: 8, name: "Leipzig" },
  { id: 9, name: "Dortmund" },
  { id: 10, name: "Essen" },
  { id: 11, name: "Bremen" },
  { id: 12, name: "Dresden" },
  { id: 13, name: "Hannover" },
  { id: 14, name: "Nürnberg" },
  { id: 15, name: "Duisburg" },
  { id: 16, name: "Bochum" },
  { id: 17, name: "Wuppertal" },
  { id: 18, name: "Bielefeld" },
  { id: 19, name: "Bonn" },
  { id: 20, name: "Mannheim" },
  { id: 21, name: "Karlsruhe" },
  { id: 22, name: "Wiesbaden" },
  { id: 23, name: "Münster" },
  { id: 24, name: "Augsburg" },
  { id: 25, name: "Mönchengladbach" },
  { id: 26, name: "Gelsenkirchen" },
  { id: 27, name: "Aachen" },
  { id: 28, name: "Braunschweig" },
  { id: 29, name: "Chemnitz" },
  { id: 30, name: "Kiel" },
  { id: 31, name: "Halle (Saale)" },
  { id: 32, name: "Magdeburg" },
  { id: 33, name: "Freiburg im Breisgau" },
  { id: 34, name: "Krefeld" },
  { id: 35, name: "Lübeck" },
  { id: 36, name: "Oberhausen" },
  { id: 37, name: "Erfurt" },
  { id: 38, name: "Mainz" },
  { id: 39, name: "Rostock" },
  { id: 40, name: "Kassel" },
  { id: 41, name: "Hagen" },
  { id: 42, name: "Hamm" },
  { id: 43, name: "Saarbrücken" },
  { id: 44, name: "Herne" },
  { id: 45, name: "Mülheim an der Ruhr" },
  { id: 46, name: "Potsdam" },
  { id: 47, name: "Ludwigshafen am Rhein" },
  { id: 48, name: "Oldenburg" },
  { id: 49, name: "Leverkusen" },
  { id: 50, name: "Osnabrück" },
  { id: 51, name: "Solingen" },
  { id: 52, name: "Heidelberg" },
  { id: 53, name: "Darmstadt" },
  { id: 54, name: "Paderborn" },
  { id: 55, name: "Regensburg" },
  { id: 56, name: "Ingolstadt" },
  { id: 57, name: "Würzburg" },
  { id: 58, name: "Fürth" },
  { id: 59, name: "Wolfsburg" },
  { id: 60, name: "Offenbach am Main" },
  { id: 61, name: "Ulm" },
  { id: 62, name: "Heilbronn" },
  { id: 63, name: "Pforzheim" },
  { id: 64, name: "Göttingen" },
  { id: 65, name: "Bottrop" },
  { id: 66, name: "Trier" },
  { id: 67, name: "Recklinghausen" },
  { id: 68, name: "Reutlingen" },
  { id: 69, name: "Bremerhaven" },
  { id: 70, name: "Koblenz" },
  { id: 71, name: "Bergisch Gladbach" },
  { id: 72, name: "Jena" },
  { id: 73, name: "Remscheid" },
  { id: 74, name: "Erlangen" },
  { id: 75, name: "Moers" },
  { id: 76, name: "Siegen" },
  { id: 77, name: "Hildesheim" },
  { id: 78, name: "Salzgitter" },
  { id: 79, name: "Cottbus" },
  { id: 80, name: "Gütersloh" },
]

/** Get city by id. */
export function getCityById(id: number): City | undefined {
  return GERMAN_CITIES.find((c) => c.id === id)
}

/** Get city name by id. */
export function getCityNameById(id: number): string | undefined {
  return getCityById(id)?.name
}

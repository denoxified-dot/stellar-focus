// One-time data build: writes the complete Messier catalog — all 110 real
// deep-sky objects — to public/messier.json, which the app can load at runtime.
// Run with:  node scripts/fetch-messier.mjs   (or: npm run fetch-messier)
//
// Unlike the exoplanet fetcher, this data is a curated, fixed catalog
// rather than a live query: the 110 Messier objects are constants. The values
// below (object type/subtype, distance in light-years, constellation, apparent
// visual magnitude) are transcribed from the accepted modern consensus —
// principally the SEDS Messier Database (http://www.messier.seds.org/) and
// cross-checked against current literature — so they match the real catalog.
// Distances for deep-sky objects carry real measurement uncertainty; the values
// here are the commonly cited best estimates, rounded.
//
// Each object has:
//   messier        Messier number (1–110)
//   name           common name, or null if it has none
//   type           broad class: "Galaxy" | "Nebula" | "Cluster" | "Other"
//   subtype        specific type, e.g. "Spiral galaxy", "Globular cluster"
//   constellation  constellation it lies in
//   distanceLy     real distance from Earth, in light-years
//   magnitude      apparent visual magnitude (lower = brighter)
//   description    a short factual description

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, '..', 'public', 'messier.json');

// prettier-ignore
const OBJECTS = [
  { messier: 1, name: 'Crab Nebula', type: 'Nebula', subtype: 'Supernova remnant', constellation: 'Taurus', distanceLy: 6500, magnitude: 8.4, description: 'The expanding wreckage of a supernova seen from Earth in 1054 AD; a rapidly spinning neutron star (pulsar) sits at its core.' },
  { messier: 2, name: null, type: 'Cluster', subtype: 'Globular cluster', constellation: 'Aquarius', distanceLy: 37500, magnitude: 6.3, description: 'One of the larger and richer globular clusters, holding roughly 150,000 stars in a sphere about 175 light-years across.' },
  { messier: 3, name: null, type: 'Cluster', subtype: 'Globular cluster', constellation: 'Canes Venatici', distanceLy: 33900, magnitude: 6.2, description: 'A brilliant globular of around half a million stars, famous for its huge population of variable stars.' },
  { messier: 4, name: null, type: 'Cluster', subtype: 'Globular cluster', constellation: 'Scorpius', distanceLy: 7200, magnitude: 5.9, description: 'One of the closest globular clusters to Earth, easily resolved into individual stars in small telescopes.' },
  { messier: 5, name: null, type: 'Cluster', subtype: 'Globular cluster', constellation: 'Serpens', distanceLy: 24500, magnitude: 5.6, description: 'An ancient globular cluster, roughly 13 billion years old, spanning about 165 light-years.' },
  { messier: 6, name: 'Butterfly Cluster', type: 'Cluster', subtype: 'Open cluster', constellation: 'Scorpius', distanceLy: 1600, magnitude: 4.2, description: 'A young open cluster whose hot blue stars trace the shape of a butterfly.' },
  { messier: 7, name: 'Ptolemy Cluster', type: 'Cluster', subtype: 'Open cluster', constellation: 'Scorpius', distanceLy: 980, magnitude: 3.3, description: 'A bright naked-eye open cluster recorded by the astronomer Ptolemy around 130 AD.' },
  { messier: 8, name: 'Lagoon Nebula', type: 'Nebula', subtype: 'Emission nebula', constellation: 'Sagittarius', distanceLy: 4100, magnitude: 6.0, description: 'A giant star-forming cloud crossed by a dark, lagoon-shaped dust lane.' },
  { messier: 9, name: null, type: 'Cluster', subtype: 'Globular cluster', constellation: 'Ophiuchus', distanceLy: 25800, magnitude: 7.7, description: 'A globular cluster near the galactic center, partly dimmed by intervening interstellar dust.' },
  { messier: 10, name: null, type: 'Cluster', subtype: 'Globular cluster', constellation: 'Ophiuchus', distanceLy: 14300, magnitude: 6.6, description: 'A relatively nearby globular cluster about 83 light-years in diameter.' },
  { messier: 11, name: 'Wild Duck Cluster', type: 'Cluster', subtype: 'Open cluster', constellation: 'Scutum', distanceLy: 6200, magnitude: 6.3, description: 'One of the richest and most compact open clusters, its brighter stars forming a V like a flight of ducks.' },
  { messier: 12, name: null, type: 'Cluster', subtype: 'Globular cluster', constellation: 'Ophiuchus', distanceLy: 15700, magnitude: 7.7, description: 'A loosely concentrated globular cluster that may have been stripped of many low-mass stars by the Milky Way.' },
  { messier: 13, name: 'Great Globular Cluster in Hercules', type: 'Cluster', subtype: 'Globular cluster', constellation: 'Hercules', distanceLy: 25100, magnitude: 5.8, description: 'The finest globular cluster in northern skies, with several hundred thousand stars; target of the 1974 Arecibo radio message.' },
  { messier: 14, name: null, type: 'Cluster', subtype: 'Globular cluster', constellation: 'Ophiuchus', distanceLy: 30300, magnitude: 7.6, description: 'A large globular cluster containing several hundred thousand stars.' },
  { messier: 15, name: null, type: 'Cluster', subtype: 'Globular cluster', constellation: 'Pegasus', distanceLy: 33600, magnitude: 6.2, description: 'One of the densest globulars known, with a collapsed core that may hide a black hole; it even contains a planetary nebula.' },
  { messier: 16, name: 'Eagle Nebula', type: 'Nebula', subtype: 'Emission nebula with cluster', constellation: 'Serpens', distanceLy: 7000, magnitude: 6.0, description: "Home of the 'Pillars of Creation' — towering columns of gas and dust where new stars are being born." },
  { messier: 17, name: 'Omega Nebula', type: 'Nebula', subtype: 'Emission nebula', constellation: 'Sagittarius', distanceLy: 5000, magnitude: 6.0, description: 'A bright star-forming region also known as the Swan or Horseshoe Nebula.' },
  { messier: 18, name: null, type: 'Cluster', subtype: 'Open cluster', constellation: 'Sagittarius', distanceLy: 4900, magnitude: 7.5, description: 'A small, young open cluster set in a rich Milky Way star field.' },
  { messier: 19, name: null, type: 'Cluster', subtype: 'Globular cluster', constellation: 'Ophiuchus', distanceLy: 28700, magnitude: 6.8, description: 'One of the most oblate (flattened) globular clusters known, distorted by the gravity of the galactic center.' },
  { messier: 20, name: 'Trifid Nebula', type: 'Nebula', subtype: 'Emission/reflection nebula', constellation: 'Sagittarius', distanceLy: 5200, magnitude: 6.3, description: 'A striking mix of red emission nebula, blue reflection nebula, and dark dust lanes that split it into three lobes.' },
  { messier: 21, name: null, type: 'Cluster', subtype: 'Open cluster', constellation: 'Sagittarius', distanceLy: 4250, magnitude: 6.5, description: 'A young, compact open cluster lying near the Trifid Nebula.' },
  { messier: 22, name: null, type: 'Cluster', subtype: 'Globular cluster', constellation: 'Sagittarius', distanceLy: 10600, magnitude: 5.1, description: 'One of the nearest and brightest globular clusters, and one of the first ever discovered; it contains a planetary nebula.' },
  { messier: 23, name: null, type: 'Cluster', subtype: 'Open cluster', constellation: 'Sagittarius', distanceLy: 2150, magnitude: 5.5, description: 'A rich open cluster of about 150 stars.' },
  { messier: 24, name: 'Sagittarius Star Cloud', type: 'Other', subtype: 'Milky Way star cloud', constellation: 'Sagittarius', distanceLy: 10000, magnitude: 4.6, description: 'Not a true cluster but a dense star cloud — a window through the dust to thousands of distant Milky Way stars.' },
  { messier: 25, name: null, type: 'Cluster', subtype: 'Open cluster', constellation: 'Sagittarius', distanceLy: 2000, magnitude: 4.6, description: 'A bright open cluster that includes a Cepheid variable star used as a cosmic distance marker.' },
  { messier: 26, name: null, type: 'Cluster', subtype: 'Open cluster', constellation: 'Scutum', distanceLy: 5000, magnitude: 8.0, description: 'A modest open cluster of about 90 stars.' },
  { messier: 27, name: 'Dumbbell Nebula', type: 'Nebula', subtype: 'Planetary nebula', constellation: 'Vulpecula', distanceLy: 1360, magnitude: 7.5, description: 'The first planetary nebula ever discovered — the glowing, shed outer layers of a dying Sun-like star.' },
  { messier: 28, name: null, type: 'Cluster', subtype: 'Globular cluster', constellation: 'Sagittarius', distanceLy: 17900, magnitude: 6.8, description: 'A compact globular cluster that contains a rapidly spinning millisecond pulsar.' },
  { messier: 29, name: null, type: 'Cluster', subtype: 'Open cluster', constellation: 'Cygnus', distanceLy: 4000, magnitude: 7.1, description: 'A small, young open cluster embedded in the rich Milky Way of Cygnus.' },
  { messier: 30, name: null, type: 'Cluster', subtype: 'Globular cluster', constellation: 'Capricornus', distanceLy: 27100, magnitude: 7.2, description: 'A globular cluster that has undergone core collapse, giving it an extremely dense center.' },
  { messier: 31, name: 'Andromeda Galaxy', type: 'Galaxy', subtype: 'Spiral galaxy', constellation: 'Andromeda', distanceLy: 2500000, magnitude: 3.4, description: 'The nearest large spiral galaxy and the most distant object visible to the unaided eye; it is on a slow collision course with the Milky Way.' },
  { messier: 32, name: null, type: 'Galaxy', subtype: 'Dwarf elliptical galaxy', constellation: 'Andromeda', distanceLy: 2650000, magnitude: 8.1, description: 'A compact dwarf elliptical galaxy orbiting the much larger Andromeda Galaxy.' },
  { messier: 33, name: 'Triangulum Galaxy', type: 'Galaxy', subtype: 'Spiral galaxy', constellation: 'Triangulum', distanceLy: 2730000, magnitude: 5.7, description: 'The third-largest galaxy in the Local Group, a face-on spiral rich with glowing star-forming regions.' },
  { messier: 34, name: null, type: 'Cluster', subtype: 'Open cluster', constellation: 'Perseus', distanceLy: 1500, magnitude: 5.5, description: 'A bright open cluster of about 100 stars, lovely in binoculars.' },
  { messier: 35, name: null, type: 'Cluster', subtype: 'Open cluster', constellation: 'Gemini', distanceLy: 2800, magnitude: 5.3, description: 'A large open cluster about the apparent size of the full Moon, with the older cluster NGC 2158 nearby.' },
  { messier: 36, name: null, type: 'Cluster', subtype: 'Open cluster', constellation: 'Auriga', distanceLy: 4100, magnitude: 6.3, description: 'A young open cluster dominated by hot, blue stars.' },
  { messier: 37, name: null, type: 'Cluster', subtype: 'Open cluster', constellation: 'Auriga', distanceLy: 4500, magnitude: 6.2, description: 'The richest open cluster in Auriga, containing roughly 500 stars.' },
  { messier: 38, name: null, type: 'Cluster', subtype: 'Open cluster', constellation: 'Auriga', distanceLy: 4200, magnitude: 7.4, description: "An open cluster whose brighter stars sketch out a cross or Greek letter 'pi'." },
  { messier: 39, name: null, type: 'Cluster', subtype: 'Open cluster', constellation: 'Cygnus', distanceLy: 800, magnitude: 4.6, description: 'A large, loose, nearby open cluster best appreciated in binoculars.' },
  { messier: 40, name: 'Winnecke 4', type: 'Other', subtype: 'Double star', constellation: 'Ursa Major', distanceLy: 510, magnitude: 8.4, description: "Not a deep-sky object at all but an optical double star — one of Messier's catalog mistakes." },
  { messier: 41, name: null, type: 'Cluster', subtype: 'Open cluster', constellation: 'Canis Major', distanceLy: 2300, magnitude: 4.5, description: 'A bright open cluster just south of Sirius, possibly noted in antiquity by Aristotle.' },
  { messier: 42, name: 'Orion Nebula', type: 'Nebula', subtype: 'Emission nebula', constellation: 'Orion', distanceLy: 1344, magnitude: 4.0, description: "The nearest large stellar nursery to Earth, visible to the naked eye as the middle 'star' of Orion's sword." },
  { messier: 43, name: "De Mairan's Nebula", type: 'Nebula', subtype: 'Emission nebula', constellation: 'Orion', distanceLy: 1600, magnitude: 9.0, description: 'Part of the Orion Nebula complex, separated from the main cloud by a dark lane of dust.' },
  { messier: 44, name: 'Beehive Cluster', type: 'Cluster', subtype: 'Open cluster', constellation: 'Cancer', distanceLy: 577, magnitude: 3.7, description: 'A bright, nearby naked-eye open cluster (also called Praesepe) known since ancient times.' },
  { messier: 45, name: 'Pleiades', type: 'Cluster', subtype: 'Open cluster', constellation: 'Taurus', distanceLy: 444, magnitude: 1.6, description: 'The Seven Sisters — a brilliant young open cluster wrapped in wisps of blue reflection nebulosity.' },
  { messier: 46, name: null, type: 'Cluster', subtype: 'Open cluster', constellation: 'Puppis', distanceLy: 5500, magnitude: 6.0, description: 'A rich open cluster with the planetary nebula NGC 2438 appearing superimposed in front of it.' },
  { messier: 47, name: null, type: 'Cluster', subtype: 'Open cluster', constellation: 'Puppis', distanceLy: 1600, magnitude: 4.2, description: 'A bright, coarse open cluster faintly visible to the naked eye.' },
  { messier: 48, name: null, type: 'Cluster', subtype: 'Open cluster', constellation: 'Hydra', distanceLy: 1500, magnitude: 5.5, description: 'A large open cluster visible to the unaided eye under dark skies.' },
  { messier: 49, name: null, type: 'Galaxy', subtype: 'Elliptical galaxy', constellation: 'Virgo', distanceLy: 56000000, magnitude: 8.4, description: 'A giant elliptical galaxy, the brightest member of the Virgo Cluster.' },
  { messier: 50, name: null, type: 'Cluster', subtype: 'Open cluster', constellation: 'Monoceros', distanceLy: 3200, magnitude: 5.9, description: 'A heart-shaped open cluster of around 200 stars.' },
  { messier: 51, name: 'Whirlpool Galaxy', type: 'Galaxy', subtype: 'Spiral galaxy', constellation: 'Canes Venatici', distanceLy: 23000000, magnitude: 8.4, description: 'A grand-design spiral interacting with a small companion; the first galaxy ever recognized to have spiral structure.' },
  { messier: 52, name: null, type: 'Cluster', subtype: 'Open cluster', constellation: 'Cassiopeia', distanceLy: 5000, magnitude: 7.3, description: 'A rich open cluster set in a dense Milky Way field.' },
  { messier: 53, name: null, type: 'Cluster', subtype: 'Globular cluster', constellation: 'Coma Berenices', distanceLy: 58000, magnitude: 7.6, description: 'A globular cluster in the outer halo of the Milky Way, about 58,000 light-years away.' },
  { messier: 54, name: null, type: 'Cluster', subtype: 'Globular cluster', constellation: 'Sagittarius', distanceLy: 87400, magnitude: 7.6, description: 'Belongs to the Sagittarius Dwarf Galaxy, not the Milky Way — the first globular cluster identified as extragalactic.' },
  { messier: 55, name: null, type: 'Cluster', subtype: 'Globular cluster', constellation: 'Sagittarius', distanceLy: 17600, magnitude: 6.3, description: 'A large, loosely concentrated globular cluster.' },
  { messier: 56, name: null, type: 'Cluster', subtype: 'Globular cluster', constellation: 'Lyra', distanceLy: 32900, magnitude: 8.3, description: 'A moderately compact globular cluster about 84 light-years across.' },
  { messier: 57, name: 'Ring Nebula', type: 'Nebula', subtype: 'Planetary nebula', constellation: 'Lyra', distanceLy: 2300, magnitude: 8.8, description: 'A famous ring-shaped planetary nebula — the glowing shell of gas cast off by a dying Sun-like star.' },
  { messier: 58, name: null, type: 'Galaxy', subtype: 'Barred spiral galaxy', constellation: 'Virgo', distanceLy: 68000000, magnitude: 9.7, description: 'A barred spiral and one of the brightest galaxies in the Virgo Cluster.' },
  { messier: 59, name: null, type: 'Galaxy', subtype: 'Elliptical galaxy', constellation: 'Virgo', distanceLy: 60000000, magnitude: 9.6, description: 'An elliptical galaxy in the Virgo Cluster with an unusually fast-rotating core.' },
  { messier: 60, name: null, type: 'Galaxy', subtype: 'Elliptical galaxy', constellation: 'Virgo', distanceLy: 55000000, magnitude: 8.8, description: 'A giant elliptical galaxy locked in gravitational interaction with the nearby spiral NGC 4647.' },
  { messier: 61, name: null, type: 'Galaxy', subtype: 'Barred spiral galaxy', constellation: 'Virgo', distanceLy: 52500000, magnitude: 9.7, description: 'A large barred spiral in the Virgo Cluster, notable for its many recorded supernovae.' },
  { messier: 62, name: null, type: 'Cluster', subtype: 'Globular cluster', constellation: 'Ophiuchus', distanceLy: 22200, magnitude: 6.5, description: 'An irregularly shaped globular cluster lying near the crowded galactic center.' },
  { messier: 63, name: 'Sunflower Galaxy', type: 'Galaxy', subtype: 'Spiral galaxy', constellation: 'Canes Venatici', distanceLy: 29300000, magnitude: 8.6, description: 'A spiral galaxy with many short, patchy arms that resemble the petals of a sunflower.' },
  { messier: 64, name: 'Black Eye Galaxy', type: 'Galaxy', subtype: 'Spiral galaxy', constellation: 'Coma Berenices', distanceLy: 17300000, magnitude: 8.5, description: "Famous for a dark band of dust sweeping in front of its bright nucleus, giving it a 'black eye'." },
  { messier: 65, name: null, type: 'Galaxy', subtype: 'Spiral galaxy', constellation: 'Leo', distanceLy: 35000000, magnitude: 9.3, description: 'A member of the Leo Triplet, a tidy trio of interacting galaxies.' },
  { messier: 66, name: null, type: 'Galaxy', subtype: 'Spiral galaxy', constellation: 'Leo', distanceLy: 36000000, magnitude: 8.9, description: 'The largest member of the Leo Triplet, its arms distorted by gravitational tugs from its neighbors.' },
  { messier: 67, name: null, type: 'Cluster', subtype: 'Open cluster', constellation: 'Cancer', distanceLy: 2700, magnitude: 6.1, description: 'One of the oldest known open clusters, around 4 billion years old.' },
  { messier: 68, name: null, type: 'Cluster', subtype: 'Globular cluster', constellation: 'Hydra', distanceLy: 33600, magnitude: 7.8, description: 'A globular cluster in the southern sky, about 106 light-years in diameter.' },
  { messier: 69, name: null, type: 'Cluster', subtype: 'Globular cluster', constellation: 'Sagittarius', distanceLy: 29700, magnitude: 7.6, description: 'A metal-rich globular cluster close to the galactic center.' },
  { messier: 70, name: null, type: 'Cluster', subtype: 'Globular cluster', constellation: 'Sagittarius', distanceLy: 29400, magnitude: 7.9, description: 'A compact globular cluster; comet Hale-Bopp was discovered right beside it in 1995.' },
  { messier: 71, name: null, type: 'Cluster', subtype: 'Globular cluster', constellation: 'Sagitta', distanceLy: 13000, magnitude: 8.2, description: 'A loose globular cluster so sparse it was long mistaken for a dense open cluster.' },
  { messier: 72, name: null, type: 'Cluster', subtype: 'Globular cluster', constellation: 'Aquarius', distanceLy: 54600, magnitude: 9.3, description: 'A remote and fairly faint globular cluster in the outer halo.' },
  { messier: 73, name: null, type: 'Other', subtype: 'Asterism', constellation: 'Aquarius', distanceLy: 2500, magnitude: 8.9, description: 'A small Y-shaped group of four stars that only appear close together — not a true cluster.' },
  { messier: 74, name: 'Phantom Galaxy', type: 'Galaxy', subtype: 'Spiral galaxy', constellation: 'Pisces', distanceLy: 32000000, magnitude: 9.4, description: "A nearly perfect, face-on 'grand design' spiral — beautiful but faint, hence its nickname." },
  { messier: 75, name: null, type: 'Cluster', subtype: 'Globular cluster', constellation: 'Sagittarius', distanceLy: 67500, magnitude: 8.5, description: 'One of the more remote and highly concentrated globular clusters in the catalog.' },
  { messier: 76, name: 'Little Dumbbell Nebula', type: 'Nebula', subtype: 'Planetary nebula', constellation: 'Perseus', distanceLy: 2500, magnitude: 10.1, description: 'A small, faint planetary nebula shaped like a miniature version of the Dumbbell Nebula.' },
  { messier: 77, name: null, type: 'Galaxy', subtype: 'Barred spiral galaxy', constellation: 'Cetus', distanceLy: 47000000, magnitude: 8.9, description: 'One of the closest and brightest Seyfert galaxies, with a brilliantly active galactic nucleus.' },
  { messier: 78, name: null, type: 'Nebula', subtype: 'Reflection nebula', constellation: 'Orion', distanceLy: 1600, magnitude: 8.3, description: 'The brightest reflection nebula in the sky, glowing by the light of hot young stars inside it.' },
  { messier: 79, name: null, type: 'Cluster', subtype: 'Globular cluster', constellation: 'Lepus', distanceLy: 41000, magnitude: 8.6, description: 'An unusual globular cluster that may have been captured from the Canis Major Dwarf Galaxy.' },
  { messier: 80, name: null, type: 'Cluster', subtype: 'Globular cluster', constellation: 'Scorpius', distanceLy: 32600, magnitude: 7.9, description: 'One of the densest globular clusters in the Milky Way.' },
  { messier: 81, name: "Bode's Galaxy", type: 'Galaxy', subtype: 'Spiral galaxy', constellation: 'Ursa Major', distanceLy: 11800000, magnitude: 6.9, description: 'A nearby grand-design spiral and one of the brightest galaxies in the sky.' },
  { messier: 82, name: 'Cigar Galaxy', type: 'Galaxy', subtype: 'Starburst galaxy', constellation: 'Ursa Major', distanceLy: 11500000, magnitude: 8.4, description: 'An edge-on starburst galaxy ablaze with star formation, triggered by a close encounter with M81.' },
  { messier: 83, name: 'Southern Pinwheel Galaxy', type: 'Galaxy', subtype: 'Barred spiral galaxy', constellation: 'Hydra', distanceLy: 15000000, magnitude: 7.5, description: 'A nearby face-on barred spiral that has hosted an unusually high number of observed supernovae.' },
  { messier: 84, name: null, type: 'Galaxy', subtype: 'Lenticular galaxy', constellation: 'Virgo', distanceLy: 60000000, magnitude: 9.1, description: 'A lenticular galaxy in the heart of the Virgo Cluster, harboring a supermassive black hole.' },
  { messier: 85, name: null, type: 'Galaxy', subtype: 'Lenticular galaxy', constellation: 'Coma Berenices', distanceLy: 60000000, magnitude: 9.1, description: 'A lenticular galaxy on the northern edge of the Virgo Cluster.' },
  { messier: 86, name: null, type: 'Galaxy', subtype: 'Lenticular galaxy', constellation: 'Virgo', distanceLy: 52000000, magnitude: 8.9, description: 'A lenticular galaxy that is actually moving toward us, falling through the Virgo Cluster.' },
  { messier: 87, name: 'Virgo A', type: 'Galaxy', subtype: 'Elliptical galaxy', constellation: 'Virgo', distanceLy: 53500000, magnitude: 8.6, description: 'A supergiant elliptical whose central black hole was the first ever directly imaged (2019); it fires off a relativistic jet.' },
  { messier: 88, name: null, type: 'Galaxy', subtype: 'Spiral galaxy', constellation: 'Coma Berenices', distanceLy: 47000000, magnitude: 9.6, description: 'A neat multi-armed spiral galaxy in the Virgo Cluster.' },
  { messier: 89, name: null, type: 'Galaxy', subtype: 'Elliptical galaxy', constellation: 'Virgo', distanceLy: 50000000, magnitude: 9.8, description: 'An almost perfectly spherical elliptical galaxy.' },
  { messier: 90, name: null, type: 'Galaxy', subtype: 'Spiral galaxy', constellation: 'Virgo', distanceLy: 58700000, magnitude: 9.5, description: 'A spiral galaxy in the Virgo Cluster that is blueshifted — moving toward the Milky Way.' },
  { messier: 91, name: null, type: 'Galaxy', subtype: 'Barred spiral galaxy', constellation: 'Coma Berenices', distanceLy: 63000000, magnitude: 10.2, description: 'A barred spiral and one of the faintest objects in the entire Messier catalog.' },
  { messier: 92, name: null, type: 'Cluster', subtype: 'Globular cluster', constellation: 'Hercules', distanceLy: 26700, magnitude: 6.3, description: 'A bright, ancient globular cluster often overlooked next to its showy neighbor M13.' },
  { messier: 93, name: null, type: 'Cluster', subtype: 'Open cluster', constellation: 'Puppis', distanceLy: 3600, magnitude: 6.0, description: 'A bright, compact open cluster of around 80 stars.' },
  { messier: 94, name: null, type: 'Galaxy', subtype: 'Spiral galaxy', constellation: 'Canes Venatici', distanceLy: 16000000, magnitude: 8.2, description: 'A spiral galaxy ringed by a bright halo of active star formation around its core.' },
  { messier: 95, name: null, type: 'Galaxy', subtype: 'Barred spiral galaxy', constellation: 'Leo', distanceLy: 32600000, magnitude: 9.7, description: 'A barred spiral with a striking ring of star formation, part of the Leo I galaxy group.' },
  { messier: 96, name: null, type: 'Galaxy', subtype: 'Spiral galaxy', constellation: 'Leo', distanceLy: 31000000, magnitude: 9.2, description: 'The brightest galaxy in the Leo I group.' },
  { messier: 97, name: 'Owl Nebula', type: 'Nebula', subtype: 'Planetary nebula', constellation: 'Ursa Major', distanceLy: 2030, magnitude: 9.9, description: "A planetary nebula whose two dark inner patches look like the staring eyes of an owl." },
  { messier: 98, name: null, type: 'Galaxy', subtype: 'Spiral galaxy', constellation: 'Coma Berenices', distanceLy: 44400000, magnitude: 10.1, description: 'An edge-on spiral in the Virgo Cluster, and one of the few galaxies approaching us rather than receding.' },
  { messier: 99, name: null, type: 'Galaxy', subtype: 'Spiral galaxy', constellation: 'Coma Berenices', distanceLy: 50000000, magnitude: 9.9, description: "A nearly face-on 'grand design' spiral in the Virgo Cluster." },
  { messier: 100, name: null, type: 'Galaxy', subtype: 'Spiral galaxy', constellation: 'Coma Berenices', distanceLy: 55000000, magnitude: 9.3, description: 'One of the brightest spiral galaxies in the Virgo Cluster, with well-defined, symmetric arms.' },
  { messier: 101, name: 'Pinwheel Galaxy', type: 'Galaxy', subtype: 'Spiral galaxy', constellation: 'Ursa Major', distanceLy: 20900000, magnitude: 7.9, description: 'A large, face-on spiral with prominent, slightly lopsided arms.' },
  { messier: 102, name: 'Spindle Galaxy', type: 'Galaxy', subtype: 'Lenticular galaxy', constellation: 'Draco', distanceLy: 50000000, magnitude: 9.9, description: 'Generally identified with the edge-on lenticular galaxy NGC 5866, though its identity was historically disputed.' },
  { messier: 103, name: null, type: 'Cluster', subtype: 'Open cluster', constellation: 'Cassiopeia', distanceLy: 8500, magnitude: 7.4, description: 'A fan-shaped open cluster and one of the more distant open clusters in the catalog.' },
  { messier: 104, name: 'Sombrero Galaxy', type: 'Galaxy', subtype: 'Spiral galaxy', constellation: 'Virgo', distanceLy: 29300000, magnitude: 8.0, description: 'An edge-on spiral with a bright central bulge and a dark dust lane, giving it the profile of a sombrero.' },
  { messier: 105, name: null, type: 'Galaxy', subtype: 'Elliptical galaxy', constellation: 'Leo', distanceLy: 32000000, magnitude: 9.8, description: 'An elliptical galaxy in the Leo I group with a well-measured central supermassive black hole.' },
  { messier: 106, name: null, type: 'Galaxy', subtype: 'Spiral galaxy', constellation: 'Canes Venatici', distanceLy: 23700000, magnitude: 8.4, description: 'A spiral galaxy with an active nucleus and strange extra arms produced by its central black hole.' },
  { messier: 107, name: null, type: 'Cluster', subtype: 'Globular cluster', constellation: 'Ophiuchus', distanceLy: 20900, magnitude: 7.9, description: 'A loosely concentrated globular cluster near the galactic center.' },
  { messier: 108, name: null, type: 'Galaxy', subtype: 'Barred spiral galaxy', constellation: 'Ursa Major', distanceLy: 46000000, magnitude: 10.0, description: 'An edge-on barred spiral seen nearly side-on, lying close to the Owl Nebula in the sky.' },
  { messier: 109, name: null, type: 'Galaxy', subtype: 'Barred spiral galaxy', constellation: 'Ursa Major', distanceLy: 83500000, magnitude: 9.8, description: 'A barred spiral galaxy and the most distant of the bright objects in the Messier catalog.' },
  { messier: 110, name: null, type: 'Galaxy', subtype: 'Dwarf elliptical galaxy', constellation: 'Andromeda', distanceLy: 2690000, magnitude: 8.5, description: 'A dwarf elliptical satellite of the Andromeda Galaxy, and the last object added to the catalog.' },
];

async function main() {
  // Sanity checks so we never ship a broken catalog.
  if (OBJECTS.length !== 110) {
    throw new Error(`Expected 110 Messier objects, have ${OBJECTS.length}.`);
  }
  for (let i = 0; i < OBJECTS.length; i++) {
    const o = OBJECTS[i];
    if (o.messier !== i + 1) throw new Error(`Out-of-order / missing Messier number at index ${i}.`);
    if (!o.type || !o.subtype || !o.constellation) throw new Error(`M${o.messier} is missing a field.`);
    if (!Number.isFinite(o.distanceLy) || !Number.isFinite(o.magnitude)) {
      throw new Error(`M${o.messier} has a non-numeric distance or magnitude.`);
    }
  }

  const payload = {
    source: 'Messier catalog — values per the SEDS Messier Database and modern consensus',
    builtAt: new Date().toISOString(),
    count: OBJECTS.length,
    objects: OBJECTS,
  };

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(payload, null, 2), 'utf8');

  console.log(`Wrote all ${OBJECTS.length} Messier objects to ${OUT_PATH}`);
}

main().catch((err) => {
  console.error('\nFailed to build Messier catalog:');
  console.error(err.message || err);
  process.exitCode = 1;
});

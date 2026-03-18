import { test, expect } from "vitest";
import { parseLLMSections } from "../llmPostProcessor";

const frenchCv = `Coordonnées
www.linkedin.com/in/farid-saidani-
b49a70305 (LinkedIn)
Farid Saidani
Agent général chez MMA Assurances
Limoges, Nouvelle-Aquitaine, France
Principales compétences
Assurances
Business-to-Business (BtoB)
Gestion des comptes
Résumé
Professionnel dans le domaine de l'assurance, je suis Agent Général
chez MMA, dédié à vous offrir des solutions personnalisées pour
répondre à vos besoins en matière d'assurance, que ce soit pour
votre activité professionnelle ou votre vie personnelle. Avec une
écoute attentive et une expertise approfondie, je m'engage à vous
conseiller au mieux pour assurer votre tranquillité d'esprit et celle de
vos proches.
Expérience
MMA Assurances
Agent général
2020 - Present (5 ans)
MUTUALITE FRANCAISE BOURGUIGNONNE SERVICES DE
SOINS ET ACCOMPAGNEMENT MUTUALISTES SSAM
Directeur de Filière
2017 - 2019 (2 ans)
Pilotage de 19 agences de services/soins à domicile (CA : 50 millions d’€/an)
 Management : 6 responsables d’agences, 1 RAF, 1 responsable
développement (900 ETP)
 Elaboration et gestion P&L régional, suivi RH, SI, certification AFNOR
 Développement de l’activité : accompagnement équipe, construction
nouvelles offres
Toshiba
Ingénieur commercial grands comptes
2014 - 2016 (2 ans)
Développement et fidélisation d’un portefeuille clients privés/publics (CA : 10
millions d’€/an)
 Vente de solutions complexes (matériels, logiciels, services, financements)
 Stratégies de compte, négociation multi-décideurs
Page 1 of 2
 Réponse aux appels d'offres et déploiement des marchés, suivi des contrats
et de la satisfaction
client
UGAP
Acheteur
2011 - 2013 (2 ans)
Elaboration d’un catalogue de produits/services à destination des collectivités
(CA : 50 millions d’€/an)
 Etudes de marchés, benchmark, définition des offres, des cibles clients
 Procédures d’achats publics (élaboration des dossiers de consultation,
analyse et choix des offres)
 Déploiement auprès de la force de vente (création d’outils, accompagnement
terrain sur clients
stratégiques…)
Toshiba
Ingénieur commercial grands comptes
2008 - 2010 (2 ans)
Formation
NEOMA Business School
· (1997 - 2001)
Page 2 of 2`;

test("manual french cv split", () => {
  const result = parseLLMSections(frenchCv);
  // Print result for inspection in CI logs
  console.log("parseLLMSections output:", JSON.stringify(result, null, 2));
  // Expect more than one section (not collapsed into a single "introduction")
  expect(result.sections.length).toBeGreaterThan(1);
  // Ensure at least one section is mapped to experience or contact/education/skills
  const fieldKeys = result.sections.map(s => s.fieldKey);
  const hasKey = fieldKeys.some(k => ["experience", "contact", "education", "skills", "languages"].includes(k));
  expect(hasKey).toBe(true);
});
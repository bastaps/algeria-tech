"""Périmètre éditorial du circuit d'articles (décision de l'éditeur, 2026-10-31).

Algeria Tech parle du numérique, des télécoms et de la tech EN ALGÉRIE.
- Offres, forfaits, tarifs, promotions, services, pannes : UNIQUEMENT ceux d'Ooredoo, Mobilis, Djezzy, Algérie Télécom, Algérie Poste
  et Algérie Télécom Satellite.
- Un opérateur ou une entreprise étrangère (Lebara, Orange, SFR, Vodafone…) n'est cité QUE s'il innove (IA, cybersécurité, réseau, satellite,
  nouveauté technologique) — jamais pour une offre commerciale, un prix, une promotion, un « bon plan » ou une panne locale.
- Le reste (institutions et entreprises algériennes, startups, numérique algérien, grandes nouvelles mondiales de la tech) reste admis.

Deux niveaux : un filtre déterministe (gratuit, sans IA) puis, pour les sujets douteux de presse, l'avis de l'IA si elle répond.
Stdlib uniquement (utilisé aussi par publier_choix.py).
"""
import re

OPERATEURS_DZ = re.compile(r"ooredoo|mobilis|djezzy|alg[ée]rie t[ée]l[ée]com|alg[ée]rie poste|\bat satellite\b", re.I)
OPERATEURS_ETRANGERS = re.compile(
    r"\blebara\b|\borange\b|\bsosh\b|\bsfr\b|bouygues|free mobile|\bfree\b|red by sfr|b&you|la poste mobile|vodafone|t-mobile|verizon|"
    r"\bat&t\b|\bo2\b|movistar|telef[oó]nica|swisscom|proximus|telenor|\bee\b|\bdigi\b|iliad|telecom italia|\btim\b|etisalat|"
    r"\bstc\b|\bzain\b|maroc telecom|\binwi\b|tunisie telecom|\bmeo\b|\bnos\b|\bsunrise\b|\bplay\b|\bmasmovil\b|\byoigo\b|\bcricket\b", re.I)
COMMERCIAL = re.compile(
    r"forfait|\boffre\b|\boffres\b|promo|tarif|\bprix\b|euros?\b|€|abonn[ée]|bon plan|r[ée]duction|gigaoctet|\bgo\b|carte sim|\besim\b|"
    r"panne|coupure|incident|clients?\b|remise|gratuit|mois offert|sans engagement", re.I)
INNOVATION = re.compile(
    r"\bia\b|intelligence artificielle|\b6g\b|satellite|cyber|innov|brevet|record|open ran|quantique|cloud souverain|mistral|openai|"
    r"anthropic|robot|laboratoire|recherche|premi[èe]re mondiale|technologie|puce|mod[èe]le", re.I)
CONTEXTE_DZ = re.compile(r"alg[ée]ri|\bdzd\b|dinars?\b|alger\b|oran\b|wilaya|arpce|\bdz\b", re.I)
URL_BONS_PLANS = re.compile(r"bons?-plans?|/promo|/deals?|soldes|black-friday|codes?-promo|comparateur-forfait", re.I)

PROMPT_PERIMETRE = """Algeria Tech est un média algérien du numérique, des télécoms et de la tech.
Règle éditoriale : les offres, forfaits, tarifs, promotions, services et pannes ne sont traités QUE pour Ooredoo, Mobilis, Djezzy, Algérie
Télécom, Algérie Poste et Algérie Télécom Satellite. Un opérateur ou une entreprise étrangère (Lebara, Orange, SFR, Vodafone…) n'est cité
QUE s'il INNOVE (IA, cybersécurité, nouvelle technologie, réseau, satellite) ; jamais pour une offre commerciale, un prix, une promotion,
un « bon plan » ou une panne locale. Les institutions, entreprises, startups et initiatives numériques algériennes sont admises, ainsi que
les grandes nouvelles mondiales de la tech.
Article : « {titre} »
Extrait : {extrait}
Cet article est-il DANS le périmètre ? Réponds UNIQUEMENT par un JSON : {{"pertinent": true|false, "raison": "une phrase"}}"""


def hors_perimetre(titre, texte="", url=""):
    """(True, raison) si le sujet sort du périmètre (filtre déterministe), sinon (False, '')."""
    t = f"{titre or ''}"
    debut = f"{t} {(texte or '')[:500]}"
    if URL_BONS_PLANS.search(url or ""):
        return True, "page « bons plans / promotions » d'un média grand public"
    en_titre_etranger = OPERATEURS_ETRANGERS.search(t)
    if en_titre_etranger and not OPERATEURS_DZ.search(t) and COMMERCIAL.search(debut) and not INNOVATION.search(t):
        return True, f"offre ou service commercial d'un opérateur étranger ({en_titre_etranger.group(0)}), sans innovation"
    if re.search(r"€|euros?\b", t, re.I) and not CONTEXTE_DZ.search(debut):
        return True, "prix en euros hors contexte algérien (offre commerciale étrangère)"
    return False, ""


def avis_ia(titre, extrait, appeler):
    """Avis de l'IA sur les sujets douteux. appeler(prompt) -> dict|None. None si l'IA ne répond pas (on n'écarte pas sans avis)."""
    rep = appeler(PROMPT_PERIMETRE.format(titre=titre, extrait=str(extrait or "")[:500]))
    if isinstance(rep, dict) and "pertinent" in rep:
        return bool(rep["pertinent"]), str(rep.get("raison") or "")
    return None


def douteux(titre, texte=""):
    """Sujet à faire arbitrer par l'IA : un opérateur / une entreprise étrangère y est cité sans que le filtre ait tranché."""
    return bool(OPERATEURS_ETRANGERS.search(f"{titre or ''} {(texte or '')[:400]}")) and not OPERATEURS_DZ.search(titre or "")

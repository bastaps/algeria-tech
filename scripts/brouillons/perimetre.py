"""Périmètre éditorial du circuit d'articles (décision de l'éditeur, 2026-10-31).

Algeria Tech parle du numérique, des télécoms et de la tech EN ALGÉRIE.
- Offres, forfaits, tarifs, promotions, services, pannes : UNIQUEMENT ceux d'Ooredoo, Mobilis, Djezzy, Algérie Télécom, Algérie Poste
  et Algérie Télécom Satellite.
- Un opérateur ou une entreprise étrangère (Lebara, Orange, SFR, Vodafone…) n'est cité QUE s'il innove (IA, cybersécurité, réseau, satellite,
  nouveauté technologique) — jamais pour une offre commerciale, un prix, une promotion, un « bon plan » ou une panne locale.
- Le reste (institutions et entreprises algériennes, startups, numérique algérien, grandes nouvelles mondiales de la tech) reste admis.
- Offres / services / promotions des entreprises algériennes des TIC, du mobile, des télécoms, de l'IA… : admis mais JAMAIS en Une → rubrique
  « Offres & Promos » (catégorie « Promos », hors flux de l'accueil). Ce qui passe en Une : activités, accords inter-entreprises, innovation,
  conférences, et les sujets habituels.
- Électroménager interdit (congélateur, mixeur, lave-linge, climatiseur…), SAUF télévisions, smartphones, box TV et serveurs.

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
ELECTROMENAGER = re.compile(
    r"cong[ée]lateur|r[ée]frig[ée]rateur|\bfrigo\b|mixeur|blender|lave-?linge|lave-?vaisselle|machine [àa] laver|s[èe]che-?linge|micro-?ondes|"
    r"cuisini[èe]re|aspirateur|climatiseur|\bclim\b|friteuse|bouilloire|cafeti[èe]re|grille-?pain|robot (?:m[ée]nager|cuiseur|p[âa]tissier)|"
    r"fer [àa] repasser|chauffe-?eau|cocotte|extracteur de jus|presse-?agrumes|plaque de cuisson|machine [àa] caf[ée]|[ée]lectrom[ée]nager", re.I)
ELECTRO_ADMIS = re.compile(r"t[ée]l[ée]vis|\btv\b|smartphone|t[ée]l[ée]phone portable|box tv|\bbox\b|set-?top|serveurs?\b|android tv", re.I)
PROMO_TITRE = re.compile(
    r"\boffres?\b|forfaits?|promo(?:tion)?s?\b|tarifs?\b|abonnements?|remises?\b|r[ée]ductions?|cashback|bundle|\bpack\b|recharges?\b|"
    r"bonus|\d[\d  .,]*\s*(?:da|dzd|dinars?)\b", re.I)
SPORT = re.compile(r"ligue [12]\b|championnat|\bfootball\b|handball|basket|\bjournée\b.*\b(?:ligue|championnat)|coupe d.alg[ée]rie|"
                   r"\busma\b|\bjsk\b|\bmco\b|\bcsc\b|\bmca\b|belouizdad|\bjs saoura\b|\bmbr\b|\bcrb\b|\bnaft\b|\bmatch\b", re.I)
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
    if SPORT.search(t):
        return True, "sport (le parrainage d'un championnat par un opérateur n'est pas une info télécom)"
    if ELECTROMENAGER.search(debut) and not ELECTRO_ADMIS.search(t):
        return True, "électroménager (hors périmètre : seuls téléviseurs, smartphones, box TV et serveurs sont admis)"
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


def est_promo(titre, extrait=""):
    """True si l'article est une offre / un service / une promotion : il va dans « Entreprises & Marques », jamais en Une."""
    return bool(PROMO_TITRE.search(titre or ""))


JEUX = re.compile(
    r"jeux? vid[ée]o|jeux? mobiles?|gaming|gamers?\b|e-?sports?|playstation|\bps[45]\b|xbox|nintendo|\bsteam\b|fortnite|minecraft|roblox|"
    r"call of duty|\bgames?\b|jeux? (?:sur|de) (?:console|pc|smartphone)", re.I)


def est_jeu(titre, extrait=""):
    """True si l'article parle de jeux vidéo : rubrique spéciale « Jeux vidéo » (catégorie Jeux), hors flux de l'accueil, JAMAIS en Une."""
    return bool(JEUX.search(f"{titre or ''} {(extrait or '')[:160]}"))


# ── Sujet : TIC / mobile / télécoms / IA / numérique — exigé de TOUT article (Algérie comme international) ─────────────────────
# 2026-11-03 : après l'ouverture aux médias algériens sans .dz et aux cas « ambigus » (1er novembre), le filtre thématique de l'express
# (mots-clés faibles : « loi », « projet de loi » = régulation, vocabulaire de santé…) laissait passer un article sur la grippe, un sujet
# bancaire et une dépêche politique sur le Sahara occidental (pour laquelle Google Flow a même généré une vidéo). Ici : un mot-clé TIC FORT est
# obligatoire dans le titre (ou deux dans le résumé), et les sujets hors TIC sont refusés explicitement.
TIC_FORT = re.compile(
    r"t[ée]l[ée]com|op[ée]rateurs?" + chr(92) + "b|" + chr(92) + "b(?:mobilis|djezzy|ooredoo)" + chr(92) + "b|alg[ée]rie t[ée]l[ée]com|alg[ée]rie poste|arpce|" + chr(92) + "b[3456]g" + chr(92) + "b|fibre|ftth|"
    r"internet|wi-?fi|haut d[ée]bit|smartphone|t[ée]l[ée]phon|mobile|applications?" + chr(92) + "b|appli" + chr(92) + "b|logiciel|software|plateforme num|num[ée]ri|"
    r"digital|d[ée]mat[ée]rialis|cyber|piratage|donn[ée]es" + chr(92) + "b|" + chr(92) + "bdata" + chr(92) + "b|cloud|datacenter|intelligence artificielle|" + chr(92) + "bia" + chr(92) + "b|" + chr(92) + "bai" + chr(92) + "b|chatgpt|openai|"
    r"" + chr(92) + "bllm" + chr(92) + "b|robot|start-?ups?|e-?paiement|paiement [ée]lectronique|mon[ée]tique|fintech|cashback|crypto|blockchain|satellite|spatial|puce|"
    r"semi-?conducteur|processeur|serveur|informatique|technolog|innovation|r[ée]seau social|" + chr(92) + "btpe" + chr(92) + "b|e-?commerce|e-?gouvernement|"
    r"" + chr(92) + "b(?:huawei|samsung|ericsson|nokia|zte|cisco|microsoft|google|apple|meta|nvidia|starlink|spacex|mistral|anthropic|oppo|xiaomi|honor|tecno|infinix)" + chr(92) + "b", re.I)
NON_TIC = re.compile(
    r"grippe|vaccin|sant[ée]\b|h[ôo]pital|m[ée]dic|cardiaque|cancer|maladie|[ée]pid[ée]mi|"
    r"loi de finances|budget|\bapn\b|s[ée]nat|parlement|[ée]lection|pr[ée]sident de la r[ée]publique|d[ée]cret pr[ée]sidentiel|gr[âa]ce|"
    r"diplomat|sahara|minurso|\bonu\b|conseil de s[ée]curit[ée]|guerre|gaza|palestin|isra[ée]l|arm[ée]e|d[ée]fense nationale|militaire|terroris|"
    r"football|handball|championnat|agricult|c[ée]r[ée]ales|bl[ée]\b|p[ée]trole|hydrocarbure|\bgaz\b|logement|tourisme|immobili|assiettes? fonci|"
    r"banque|bancaire|inflation|dinar|bourse|march[ée] financier|douane|saisie|drogue|accident|incendie|m[ée]t[ée]o|culture|cin[ée]ma|"
    r"commémor|anniversaire|r[ée]volution du|f[êe]te|religieu|ramadan|hadj|omra", re.I)


def hors_sujet(titre, resume=""):
    """(True, raison) si l'article n'est pas du domaine TIC / mobile / télécoms / IA / numérique."""
    t, r = titre or "", (resume or "")[:500]
    fort_titre = TIC_FORT.search(t)
    if NON_TIC.search(t) and not fort_titre:
        return True, f"hors sujet TIC (« {NON_TIC.search(t).group(0)} » dans le titre, aucun mot-clé TIC)"
    if not fort_titre and len(TIC_FORT.findall(r)) < 2:
        return True, "aucun mot-clé TIC fort dans le titre (et moins de 2 dans le résumé)"
    return False, ""


def non_tic_evident(titre):
    """Titre manifestement hors TIC (santé, politique, sport, banque, agriculture…) sans aucun mot-clé TIC : écarté avant tout classement."""
    return bool(NON_TIC.search(titre or "")) and not TIC_FORT.search(titre or "")

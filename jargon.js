'use strict';
/* ═══════════════════════════════════════════════════════════════
   JARGON.JS — Algeria Tech
   Surlignage automatique des termes techniques + tooltip Algérie
   ─────────────────────────────────────────────────────────────
   Usage public :
     highlightJargon() — appelé automatiquement à l'ouverture d'article
     resetJargon()     — appelé à la fermeture de l'article
═══════════════════════════════════════════════════════════════ */

/* ── Dictionnaire (contextualisé Algérie) ─────────────────────
   Clés triées longest-first à la construction du regex,
   pour matcher "5G SA" avant "5G", "ADSL2+" avant "ADSL", etc.
─────────────────────────────────────────────────────────────── */
const JARGON = {

  /* Régulateurs & Institutions ──────────────────────────────── */
  'ARPT'              : 'Autorité de Régulation de la Poste et des Télécommunications — régulateur algérien du secteur télécom depuis 2000, sous tutelle du MPTIC.',
  'MPTIC'             : 'Ministère de la Poste, des Télécommunications, des Technologies et du Numérique — ministère de tutelle du numérique en Algérie.',
  'CERIST'            : 'Centre de Recherche sur l\'Information Scientifique et Technique — gère le ccTLD .dz et la connectivité Internet nationale depuis 1985.',
  'ANPT'              : 'Agence Nationale de Promotion et de Développement des Parcs Technologiques — pilote les technopoles algériennes (Sidi Abdallah, etc.).',

  /* Réseaux mobiles ─────────────────────────────────────────── */
  '5G SA'             : '5G Standalone — architecture 5G 100 % autonome, sans dépendance au cœur de réseau 4G. Étape finale du déploiement 5G.',
  '5G NSA'            : '5G Non-Standalone — architecture 5G utilisant le cœur de réseau 4G existant. Première phase de déploiement 5G.',
  '5G'                : 'Cinquième génération mobile. Des tests ont été menés par Mobilis et Djezzy en Algérie ; aucun déploiement commercial officiel à ce jour.',
  'LTE-A'             : 'LTE Advanced — évolution de la 4G atteignant 1 Gbps par agrégation de porteuses. Proposée par les opérateurs algériens.',
  'LTE'               : 'Long Term Evolution — standard technique de la 4G. Déployé par Mobilis, Djezzy et Ooredoo en Algérie depuis 2016.',
  '4G+'               : 'LTE Advanced — version améliorée de la 4G. Commercialisée par les trois opérateurs mobiles algériens.',
  '4G'                : 'Quatrième génération mobile. Lancée en Algérie en 2016 ; couverture encore inégale dans les zones rurales.',
  'HSPA+'             : 'Evolved HSPA — surnommée 3.75G. Débits jusqu\'à 84 Mbps, déployée en Algérie avant l\'arrivée de la 4G.',
  'HSPA'              : 'High Speed Packet Access — évolution data de la 3G/UMTS, précurseur de la 4G en Algérie.',
  '3G'                : 'Troisième génération mobile. Lancée en Algérie en 2013 ; en cours de remplacement progressif par la 4G.',
  'GSM'               : 'Global System for Mobile Communications — standard 2G, base historique de la téléphonie mobile algérienne.',
  'UMTS'              : 'Universal Mobile Telecommunications System — standard technique de la 3G déployé en Algérie.',
  'MVNO'              : 'Mobile Virtual Network Operator — opérateur mobile sans réseau propre. N\'existe pas encore officiellement en Algérie ; cadre réglementaire en discussion à l\'ARPT.',
  'MNO'               : 'Mobile Network Operator — opérateur détenant ses propres fréquences. En Algérie : Mobilis, Djezzy, Ooredoo.',
  'O-RAN'             : 'Open Radio Access Network — architecture RAN ouverte et multi-fournisseurs. Réduit la dépendance à un seul équipementier (Huawei, Nokia, Ericsson).',
  'RAN'               : 'Radio Access Network — partie radio du réseau mobile (antennes, BTS). En Algérie, principalement fournie par Huawei, Nokia et Ericsson.',
  'Massive MIMO'      : 'Multiple-Input Multiple-Output massif — antennes à centaines d\'éléments multipliant les flux data. Technologie clé de la 5G.',
  'Beamforming'       : 'Formation de faisceau — dirige le signal radio vers un utilisateur précis. Composante essentielle de la 5G pour la densité urbaine.',
  'Small Cell'        : 'Petite cellule radio (picocell, femtocell) déployée pour renforcer la couverture en intérieur ou en zones denses.',
  'HetNet'            : 'Heterogeneous Network — combinaison de macrocellules et small cells. Architecture adoptée par les opérateurs algériens pour densifier leur réseau.',
  'mmWave'            : 'Millimeter Wave — fréquences 5G au-dessus de 24 GHz offrant des Gbps sur courte distance. Non encore attribuées en Algérie.',

  /* Spectre ──────────────────────────────────────────────────── */
  'Spectre'           : 'Spectre radioélectrique — ressource rare attribuée par l\'ARPT aux opérateurs via licences. Objet d\'appels d\'offres publics en Algérie.',
  'Dividende numérique': 'Fréquences libérées par la transition vers la TNT. La bande 700 MHz (2e dividende numérique) est convoitée pour la 4G/5G rurale en Algérie.',
  'MHz'               : 'Mégahertz — unité de fréquence radio. Ex : la bande 900 MHz est utilisée pour la 4G en zones rurales en Algérie.',
  'GHz'               : 'Gigahertz — 1 GHz = 1 000 MHz. La bande 3,5 GHz est candidate pour la future 5G algérienne.',

  /* Réseaux fixes & FTTx ─────────────────────────────────────── */
  'FTTx'              : 'Fiber To The x — famille de déploiements fibre selon le point de terminaison : FTTH (domicile), FTTB (immeuble), FTTC (cabinet), FTTN (nœud).',
  'FTTH'              : 'Fiber To The Home — fibre optique jusqu\'au domicile de l\'abonné. Déployée par Algérie Télécom dans les grandes agglomérations algériennes.',
  'FTTB'              : 'Fiber To The Building — fibre jusqu\'au pied d\'immeuble, puis cuivre ou coaxial jusqu\'à l\'appartement. Moins cher que le FTTH.',
  'FTTC'              : 'Fiber To The Cabinet — fibre jusqu\'au sous-répartiteur de rue, puis cuivre. Étape intermédiaire de montée en débit avant le FTTH.',
  'FTTN'              : 'Fiber To The Node — fibre jusqu\'au nœud de raccordement, puis cuivre existant. Solution transitoire pour accélérer la montée en débit.',
  'FTTP'              : 'Fiber To The Premises — fibre jusqu\'aux locaux (entreprises ou résidences). Synonyme de FTTH dans certaines nomenclatures.',
  'XGS-PON'           : 'Symétrique 10 Gbps PON — évolution du GPON pour répondre à la demande croissante en bande passante des abonnés FTTH.',
  'NG-PON2'           : 'Next Generation PON 2 — standard PON de 40 Gbps agrégés. Futur du réseau fibre passif après le GPON.',
  'GPON'              : 'Gigabit Passive Optical Network — standard fibre passif (2.5/1.25 Gbps). Utilisé par Algérie Télécom pour ses déploiements FTTH.',
  'ADSL2+'            : 'Version améliorée de l\'ADSL offrant jusqu\'à 24 Mbps en débit descendant. Standard déployé par Algérie Télécom sur paire de cuivre.',
  'ADSL'              : 'Asymmetric DSL — haut débit sur ligne téléphonique cuivre. Principal accès fixe résidentiel en Algérie via Algérie Télécom.',
  'VDSL2'             : 'VDSL de 2e génération — jusqu\'à 100 Mbps sur cuivre courte distance. Déployé par Algérie Télécom comme transition vers la fibre.',
  'VDSL'              : 'Very-high-bit-rate DSL — haut débit sur cuivre courte distance. Proposé par Algérie Télécom avant le déploiement FTTH.',
  'xDSL'              : 'Famille de technologies DSL (ADSL, VDSL, ADSL2+…) utilisant la paire de cuivre téléphonique pour le haut débit.',
  'VSAT'              : 'Very Small Aperture Terminal — connexion Internet par satellite via petite parabole. Utilisée dans les zones rurales et sahariennes en Algérie.',
  'PON'               : 'Passive Optical Network — réseau fibre sans équipements actifs intermédiaires. Base technique du GPON déployé par Algérie Télécom.',
  'Dark fiber'        : 'Fibre optique installée mais non encore exploitée commercialement. Algérie Télécom dispose d\'un réseau national de dark fiber louable aux opérateurs.',
  'Backbone'          : 'Épine dorsale du réseau à très haut débit reliant les grands nœuds nationaux. Le backbone algérien est opéré par Algérie Télécom.',
  'Backhaul'          : 'Liaison entre les antennes radio et le cœur de réseau. Peut être fibre, micro-ondes ou satellite selon la zone géographique.',
  'Last mile'         : 'Dernier kilomètre — segment final reliant le réseau à l\'abonné. Principal défi du haut débit en Algérie, surtout en zones rurales.',
  'Boucle locale'     : 'Segment réseau entre l\'abonné et le central téléphonique. Détenue quasi-exclusivement par Algérie Télécom en Algérie.',
  'HFC'               : 'Hybrid Fiber-Coaxial — réseau mêlant fibre et câble coaxial. Non déployé en Algérie ; le réseau fixe repose sur cuivre et fibre.',

  /* IP & Protocoles ─────────────────────────────────────────── */
  'IPv6'              : 'Internet Protocol v6 — successeur d\'IPv4 avec espace d\'adressage quasi-illimité. Adoption encore faible en Algérie malgré l\'épuisement global des IPv4.',
  'IPv4'              : 'Internet Protocol v4 — protocole d\'adressage dominant. Les adresses IPv4 sont épuisées mondialement depuis 2011.',
  'DNSSEC'            : 'Extension sécurité du DNS — protège contre le DNS spoofing. En cours de déploiement sur le domaine .dz géré par le CERIST.',
  'BGP'               : 'Border Gateway Protocol — protocole de routage inter-domaines sur Internet. Gouverne l\'échange de trafic entre FAI algériens.',
  'MPLS'              : 'Multi-Protocol Label Switching — routage rapide par étiquettes dans les réseaux d\'opérateurs. Utilisé dans le backbone d\'Algérie Télécom.',
  'SD-WAN'            : 'Software Defined WAN — WAN géré logiciellement. Adopté par les entreprises algériennes multisite pour relier leurs agences.',
  'SDN'               : 'Software Defined Networking — réseau piloté par logiciel, séparant contrôle et données. En cours d\'adoption chez les opérateurs algériens.',
  'NFV'               : 'Network Functions Virtualization — virtualisation des fonctions réseau (pare-feu, routeur…). Réduit les coûts matériels des opérateurs.',
  'CGNAT'             : 'Carrier Grade NAT — traduction d\'adresses à grande échelle chez les opérateurs pour pallier la pénurie d\'IPv4.',
  'CDN'               : 'Content Delivery Network — réseau de serveurs géorépartis accélérant la diffusion de contenu. Peu de nœuds CDN locaux en Algérie, d\'où des latences élevées.',
  'IXP'               : 'Internet Exchange Point — point d\'échange Internet local réduisant les coûts de transit. L\'Algérie dispose de l\'ALGIX (Alger), géré par le CERIST.',
  'Peering'           : 'Accord d\'échange de trafic gratuit entre opérateurs de même taille. Pratique peu développée en Algérie, augmentant les coûts de transit.',
  'DPI'               : 'Deep Packet Inspection — analyse approfondie des paquets réseau. Utilisée pour la QoS, la lutte contre la fraude et potentiellement le filtrage de contenu.',
  'VoIP'              : 'Voice over IP — téléphonie via Internet. WhatsApp, Viber, Skype sont des OTT VoIP très populaires en Algérie.',
  'OTT'               : 'Over-The-Top — services (WhatsApp, YouTube, Netflix…) transitant sur Internet sans accord commercial avec l\'opérateur réseau. Sujet de friction réglementaire en Algérie.',
  'QoS'               : 'Quality of Service — priorisation des flux réseau critiques (voix, vidéo, urgence). Réglementée par l\'ARPT en Algérie.',
  'DNS'               : 'Domain Name System — annuaire d\'Internet convertissant les noms de domaine en adresses IP. Le ccTLD .dz est géré par le CERIST.',
  'VPN'               : 'Virtual Private Network — tunnel chiffré sécurisant les communications. Statut légal ambigu en Algérie ; tolérés pour les entreprises.',
  'Roaming'           : 'Itinérance internationale — utilisation du réseau d\'un opérateur étranger à l\'étranger. Tarifs régulés par l\'ARPT ; accords avec pays arabes et africains.',
  'Neutralité du réseau': 'Principe d\'égalité de traitement de tous les flux Internet par les opérateurs. Peu encadré réglementairement en Algérie à ce jour.',
  'Bande passante'    : 'Capacité maximale de transfert de données d\'un lien réseau, exprimée en Mbps ou Gbps.',
  'Latence'           : 'Délai de transmission réseau en millisecondes. Souvent élevée en Algérie (>80 ms) en raison du manque de nœuds CDN locaux.',
  'Jitter'            : 'Variation de la latence dans le temps. Dégrade la qualité VoIP (Teams, Zoom, WhatsApp) au-delà de 30 ms.',

  /* Cybersécurité ─────────────────────────────────────────────── */
  'CERT-DZ'           : 'Computer Emergency Response Team Algérie — organisme national de réponse aux incidents de cybersécurité, sous tutelle du MPTIC.',
  'Zero Trust'        : 'Architecture sécurité "ne jamais faire confiance" — chaque accès est vérifié même en réseau interne. Adoptée progressivement par les grandes entreprises algériennes.',
  'Zero-day'          : 'Vulnérabilité inconnue du fabricant, exploitable avant tout correctif. Utilisée dans les attaques ciblées étatiques ou organisées.',
  'Ransomware'        : 'Logiciel de rançon chiffrant les données contre paiement. Menace croissante pour les entreprises et administrations algériennes.',
  'Phishing'          : 'Hameçonnage — escroquerie par usurpation d\'identité (email, SMS, faux site). L\'une des cybermenaces les plus répandues en Algérie.',
  'Spear phishing'    : 'Hameçonnage ciblé — phishing personnalisé visant un individu ou une organisation spécifique. Plus dangereux que le phishing classique.',
  'Pentest'           : 'Test d\'intrusion — simulation d\'attaque autorisée pour identifier les vulnérabilités d\'un système informatique.',
  'DDoS'              : 'Distributed Denial of Service — attaque saturant un serveur depuis des milliers de machines compromises. Des sites gouvernementaux algériens en ont été victimes.',
  'Botnet'            : 'Réseau de machines infectées contrôlées à distance, utilisé pour les attaques DDoS, le spam ou le minage de cryptos.',
  'SIEM'              : 'Security Information and Event Management — outil de corrélation d\'événements de sécurité en temps réel pour détecter les incidents.',
  'SOC'               : 'Security Operations Center — centre de supervision de la sécurité 24h/24. Déployé dans quelques grandes entreprises et banques algériennes.',
  'APT'               : 'Advanced Persistent Threat — attaque ciblée et prolongée par des acteurs étatiques ou très organisés. Le CERT-DZ publie des alertes périodiques à ce sujet.',
  'WAF'               : 'Web Application Firewall — pare-feu protégeant les applications web (injections SQL, XSS, etc.).',
  'Pare-feu'          : 'Firewall — dispositif filtrant le trafic réseau selon des règles de sécurité prédéfinies.',
  'Chiffrement'       : 'Encodage des données pour les rendre illisibles sans clé cryptographique. Obligatoire pour les transactions financières en Algérie.',
  'MFA'               : 'Multi-Factor Authentication — authentification multi-facteurs (mot de passe + SMS + biométrie…). Imposée par la Banque d\'Algérie pour les services bancaires en ligne.',

  /* Blockchain & Crypto ─────────────────────────────────────── */
  'Proof of Stake'    : 'Consensus blockchain moins énergivore que le minage (PoW). Utilisé par Ethereum depuis "The Merge" de septembre 2022.',
  'Smart contract'    : 'Contrat auto-exécutable codé sur blockchain, sans intermédiaire. Non reconnu légalement par le droit algérien à ce jour.',
  'Cryptomonnaie'     : 'Monnaie virtuelle cryptographique. Interdite en Algérie par l\'article 117-bis de la loi de finances 2018.',
  'Stablecoin'        : 'Cryptomonnaie indexée sur une devise réelle (ex: dollar). Sous les mêmes restrictions légales que les autres cryptos en Algérie.',
  'Blockchain'        : 'Registre distribué et immuable de transactions. Technologie de base des cryptomonnaies, interdites en Algérie depuis la loi de finances 2018.',
  'Ethereum'          : 'Blockchain programmable supportant les smart contracts. Ses tokens (ETH) sont sous la même interdiction que le Bitcoin en Algérie.',
  'Bitcoin'           : 'Première cryptomonnaie mondiale (2009). Son usage et sa détention sont illégaux en Algérie depuis la loi de finances 2018 (art. 117-bis).',
  'Minage'            : 'Validation des transactions blockchain par calcul intensif (Proof of Work). Très énergivore et non réglementé en Algérie.',
  'Stablecoin'        : 'Cryptomonnaie dont la valeur est arrimée à une devise (ex: USDT). Même statut juridique que les cryptomonnaies classiques en Algérie.',
  'DeFi'              : 'Decentralized Finance — finance décentralisée sur blockchain sans banque intermédiaire. Zone grise réglementaire en Algérie.',
  'NFT'               : 'Non-Fungible Token — actif numérique unique sur blockchain (art, musique, jeux…). Non réglementé spécifiquement en Algérie, juridiquement incertain.',
  'Web3'              : 'Internet décentralisé basé sur la blockchain. Concept émergent sans cadre légal en Algérie.',
  'DAO'               : 'Decentralized Autonomous Organization — organisation gouvernée par des règles codées sur blockchain. Concept sans équivalent légal en Algérie.',

  /* IA & Data ─────────────────────────────────────────────────── */
  'Machine Learning'  : 'Apprentissage automatique — l\'IA apprend à partir de données sans règles explicites. Utilisé en Algérie dans la détection de fraude bancaire et la météorologie.',
  'Deep Learning'     : 'Apprentissage profond — réseaux de neurones multicouches. Sous-domaine du ML plus puissant mais exigeant en données et GPU.',
  'Edge computing'    : 'Traitement des données au plus proche de leur source (antennes, IoT) pour réduire la latence. Crucial pour les applications temps réel et Smart City.',
  'Cloud computing'   : 'Accès à des ressources informatiques via Internet à la demande. Le projet "Algeria Cloud" souverain est en cours de développement sous l\'égide du MPTIC.',
  'Data center'       : 'Centre de données hébergeant serveurs et équipements réseau. L\'Algérie développe ses propres data centers nationaux pour réduire la dépendance aux hébergeurs européens.',
  'Data Lake'         : 'Dépôt centralisé de données brutes à grande échelle. Utilisé par les opérateurs télécom algériens pour l\'analyse de réseau.',
  'Big Data'          : 'Très grands volumes de données (volume, vélocité, variété). Exploité en Algérie par les télécoms, la DGI et le secteur bancaire.',
  'NLP'               : 'Natural Language Processing — traitement automatique du langage. Utilisé pour l\'analyse de contenu en arabe dialectal (darija) et en arabe standard.',
  'LLM'               : 'Large Language Model — modèle de langage de grande taille (GPT, Claude, LLaMA…). Base des assistants IA génératifs de texte.',
  'GPU'               : 'Processeur graphique massivement parallèle — indispensable pour l\'entraînement des modèles d\'IA. Difficile à importer en Algérie (restrictions douanières).',
  'IaaS'              : 'Infrastructure as a Service — location de serveurs virtuels en nuage. Offert localement par Algérie Télécom Entreprises et quelques acteurs privés.',
  'SaaS'              : 'Software as a Service — logiciel hébergé accessible via navigateur. Modèle dominant des nouvelles solutions ERP/CRM déployées en Algérie.',
  'PaaS'              : 'Platform as a Service — plateforme de développement en nuage. Peu d\'offres locales ; les startups algériennes se tournent vers AWS ou Azure.',
  'IA'                : 'Intelligence Artificielle — axe prioritaire de la stratégie Algeria Digital 2025. Laboratoires de recherche actifs au CERIST, CDTA et universités algériennes.',

  /* IoT & Smart ─────────────────────────────────────────────── */
  'Digital Twin'      : 'Jumeau numérique — réplique virtuelle d\'un objet physique mise à jour en temps réel. Concept émergent pour les infrastructures critiques algériennes.',
  'Smart City'        : 'Ville intelligente utilisant les TIC pour optimiser les services urbains. Projets actifs à Alger, Oran, Constantine et Sidi Abdallah.',
  'Smart Grid'        : 'Réseau électrique intelligent intégrant les TIC. Projet prioritaire de Sonelgaz pour moderniser la distribution d\'énergie.',
  'LoRaWAN'           : 'Long Range Wide Area Network — protocole IoT longue portée, faible consommation. Utilisé dans des projets d\'agriculture connectée en Algérie.',
  'NB-IoT'            : 'Narrowband IoT — standard mobile basse consommation pour objets connectés. Déployé par Mobilis et Ooredoo en Algérie.',
  'LPWAN'             : 'Low Power Wide Area Network — famille de réseaux IoT longue portée (LoRaWAN, Sigfox, NB-IoT).',
  'SCADA'             : 'Supervisory Control and Data Acquisition — système de contrôle industriel. Utilisé par Sonatrach, Sonelgaz et Algérie Télécom pour leur réseau.',
  'IIoT'              : 'Industrial IoT — IoT appliqué à l\'industrie (Sonatrach, Sonelgaz). Potentiel important pour la maintenance prédictive des infrastructures.',
  'IoT'               : 'Internet of Things — objets connectés (capteurs, caméras, compteurs…). En développement en Algérie pour les smart cities, l\'agriculture et la gestion de l\'eau.',
  'M2M'               : 'Machine to Machine — communication directe entre appareils sans humain. Précurseur de l\'IoT, très utilisé dans les télécoms et l\'énergie en Algérie.',

  /* FinTech & Paiement ─────────────────────────────────────── */
  'GIE Monétique'     : 'Groupement d\'Intérêt Économique Monétique Algérie — infrastructure nationale de paiement interbancaire (TPE, DAB, e-paiement).',
  'Open banking'      : 'Ouverture des données bancaires à des tiers via API. Concept embryonnaire en Algérie, freiné par le conservatisme du secteur bancaire public.',
  'Edahabia'          : 'Carte de paiement d\'Algérie Poste. La carte grand public la plus répandue en Algérie, utilisable en ligne, en TPE et dans les DAB.',
  'FinTech'           : 'Financial Technology — startups alliant finance et technologie. Secteur émergent en Algérie, encadré par la Banque d\'Algérie et le Startup Act.',
  'RegTech'           : 'Regulatory Technology — outils technologiques pour la conformité réglementaire. En émergence dans les banques et assurances algériennes.',
  'NFC'               : 'Near Field Communication — communication sans contact à courte portée. Intégrée aux nouvelles cartes CIB et Edahabia pour le paiement sans contact.',
  'CIB'               : 'Carte Interbancaire — carte bancaire algérienne, gérée par le GIE Monétique Algérie.',

  /* Startups & Réglementation ─────────────────────────────── */
  'Startup Act'       : 'Loi algérienne n°22-12 sur les startups. Offre label, avantages fiscaux, accès au foncier et financement public (Algérie Ventures, SAAÏD).',
  'Loi 18-07'         : 'Loi algérienne relative à la protection des données personnelles (2018) — équivalent local du RGPD européen.',
  'Licence télécom'   : 'Autorisation délivrée par l\'ARPT pour opérer un réseau télécom en Algérie. Trois licences mobiles actives : Mobilis, Djezzy, Ooredoo.',
  'Incubateur'        : 'Structure d\'accompagnement de startups (SAAÏD, Algeria Ventures, NEXUS…). Réseau en fort développement depuis 2020 en Algérie.',
  'Interconnexion'    : 'Accord technique et commercial entre opérateurs pour s\'échanger du trafic. Réglementé par l\'ARPT via des offres de référence.',
  'Dégroupage'        : 'Accès d\'opérateurs tiers au réseau cuivre d\'Algérie Télécom. Très limité en Algérie ; Algérie Télécom reste dominant sur la boucle locale.',
  'Licorne'           : 'Startup valorisée à plus d\'1 milliard de dollars. L\'Algérie n\'en compte pas encore officiellement mais vise l\'objectif à l\'horizon 2030.',
  'Scale-up'          : 'Startup en phase de croissance rapide ayant validé son modèle. Profil rare mais émergent dans l\'écosystème algérien.',
  'RGPD'              : 'Règlement Général sur la Protection des Données (UE). Son équivalent algérien est la loi 18-07 de 2018.',

  /* Infrastructure & DevOps ──────────────────────────────── */
  'Microservices'     : 'Architecture décomposant une application en services indépendants. Adoptée par les startups algériennes à fort volume de trafic.',
  'Kubernetes'        : 'Orchestrateur de conteneurs — gère déploiement et montée en charge des applications cloud. Adopté par les startups algériennes avancées.',
  'Serverless'        : 'Modèle cloud sans gestion de serveurs — facturation à l\'usage réel. Peu d\'offres locales en Algérie.',
  'DevOps'            : 'Culture unissant développement et opérations — automatisation du cycle de livraison logicielle. En adoption croissante dans les DSI algériennes.',
  'Docker'            : 'Plateforme de conteneurisation — isole les applications dans des conteneurs légers et portables.',
  'CI/CD'             : 'Intégration Continue / Déploiement Continu — automatisation des tests et de la mise en production. Pratique standard des startups algériennes.',
  'API'               : 'Application Programming Interface — interface permettant à deux logiciels de communiquer. Base de l\'économie des plateformes numériques algériennes.',
};

/* ═══════════════════════════════════════════════════════════════
   MOTEUR — Surlignage + Tooltip
═══════════════════════════════════════════════════════════════ */
(function () {

  let _tt = null;   // singleton tooltip

  /* ── Tooltip ── */
  function _getTooltip() {
    if (!_tt) {
      _tt = document.createElement('div');
      _tt.id = 'jargonTooltip';
      document.body.appendChild(_tt);
      // Fermeture au scroll ou clic ailleurs
      document.addEventListener('scroll', _hide, { passive: true });
      document.addEventListener('touchstart', function (e) {
        if (_tt && !e.target.classList.contains('jargon-term')) _hide();
      }, { passive: true });
    }
    return _tt;
  }

  function _hide() { if (_tt) _tt.classList.remove('jt-vis'); }

  function _show(e) {
    const span = e.currentTarget;
    const tt   = _getTooltip();
    tt.innerHTML =
      '<strong class="jt-term">' + span.dataset.term + '</strong>' +
      '<span class="jt-def">' + span.dataset.def + '</span>';
    tt.classList.add('jt-vis');

    requestAnimationFrame(function () {
      const r   = span.getBoundingClientRect();
      const w   = tt.offsetWidth;
      const h   = tt.offsetHeight;
      let top   = r.top  + window.scrollY - h - 10;
      let left  = r.left + window.scrollX + r.width / 2 - w / 2;
      // Si trop haut → passer en dessous
      if (top < window.scrollY + 5) top = r.bottom + window.scrollY + 10;
      // Rester dans la viewport
      left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
      tt.style.top  = top  + 'px';
      tt.style.left = left + 'px';
    });
  }

  /* ── Lookup insensible à la casse ── */
  function _def(word) {
    if (JARGON[word]) return JARGON[word];
    var lo  = word.toLowerCase();
    var key = Object.keys(JARGON).find(function (k) { return k.toLowerCase() === lo; });
    return key ? JARGON[key] : '';
  }

  /* ── Regex dynamique (longest-first pour multi-mots) ── */
  function _buildRe() {
    var terms = Object.keys(JARGON).sort(function (a, b) { return b.length - a.length; });
    // Déduplique (clés dupliquées par erreur possible)
    terms = terms.filter(function (t, i, a) { return a.indexOf(t) === i; });
    var esc = terms.map(function (t) {
      return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    });
    // Boundary Unicode (couvre les caractères accentués français)
    try {
      return new RegExp(
        '(?<![\\wÀ-ÖØ-öø-ÿ])(' + esc.join('|') + ')(?![\\wÀ-ÖØ-öø-ÿ])',
        'gi'
      );
    } catch (e) {
      // Fallback \b pour navigateurs sans lookbehind
      return new RegExp('\\b(' + esc.join('|') + ')\\b', 'gi');
    }
  }

  /* ── TreeWalker : trouve et remplace les nœuds texte ── */
  function _highlight(root) {
    var re    = _buildRe();
    var count = 0;
    var SKIP  = { SCRIPT:1, STYLE:1, A:1, BUTTON:1, CODE:1, PRE:1, H1:1 };

    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var nodes  = [];
    var n;
    while ((n = walker.nextNode())) {
      var tag = n.parentElement && n.parentElement.tagName;
      if (SKIP[tag]) continue;
      if (n.parentElement && n.parentElement.classList.contains('jargon-term')) continue;
      nodes.push(n);
    }

    nodes.forEach(function (textNode) {
      var text = textNode.textContent;
      re.lastIndex = 0;
      if (!re.test(text)) return;
      re.lastIndex = 0;

      var frag = document.createDocumentFragment();
      var last = 0, m;
      while ((m = re.exec(text)) !== null) {
        if (m.index > last) {
          frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        }
        var sp = document.createElement('span');
        sp.className      = 'jargon-term';
        sp.textContent    = m[0];
        sp.dataset.term   = m[0];
        sp.dataset.def    = _def(m[0]);
        sp.addEventListener('mouseenter', _show);
        sp.addEventListener('mouseleave', _hide);
        sp.addEventListener('touchstart', function (e) {
          e.stopPropagation();
          _show(e);
        }, { passive: true });
        frag.appendChild(sp);
        last = m.index + m[0].length;
        count++;
      }
      if (last < text.length) {
        frag.appendChild(document.createTextNode(text.slice(last)));
      }
      if (textNode.parentNode) {
        textNode.parentNode.replaceChild(frag, textNode);
      }
    });

    return count;
  }

  /* ── Supprime les surlignages ── */
  function _clear(root) {
    if (!root) return;
    root.querySelectorAll('.jargon-term').forEach(function (sp) {
      if (sp.parentNode) sp.parentNode.replaceChild(document.createTextNode(sp.textContent), sp);
    });
    root.normalize();
    _hide();
  }

  /* ── API publique ─────────────────────────────────────────── */
  window.highlightJargon = function () {
    var article = document.querySelector('.article-text');
    if (!article) return;
    _highlight(article);
  };

  window.resetJargon = function () {
    _clear(document.querySelector('.article-text'));
  };

})();

/**
 * Textes de l'appli mobile, en français, en tutoyant l'élève. Aucun texte en
 * dur dans les écrans : tout vient d'ici. Les textes qui dépendent d'une
 * valeur sont des fonctions (pluriels compris).
 */

const plural = (count: number, one: string, other: string) =>
  count <= 1 ? one : other;

const date = (iso: string, withTime = false) =>
  new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });

export const fr = {
  appName: "Wema",
  common: {
    back: "Retour",
    retry: "Réessayer",
    loading: "Chargement…",
    notionUnknown: "Notion",
    dueOn: (iso: string, withTime = false) =>
      `À rendre le ${date(iso, withTime)}`,
    cancel: "Annuler",
  },
  tabs: {
    home: "Accueil",
    assignments: "Devoirs",
    tutor: "Prof IA",
    messages: "Messages",
    me: "Moi",
  },
  login: {
    title: "Bienvenue sur Wema",
    subtitle: "Connecte-toi pour retrouver tes exercices et ton prof IA.",
    withEmail: "E-mail",
    withCode: "Identifiant élève",
    email: "Adresse e-mail",
    password: "Mot de passe",
    username: "Identifiant",
    usernameHint: "Ton identifiant et ton code t'ont été donnés par ton école.",
    code: "Code de connexion",
    submit: "Me connecter",
    pending: "Connexion…",
    server: (url: string) => `Serveur : ${url}`,
  },
  terms: {
    title: "Nouvelles conditions",
    body: "Avant de continuer, lis les conditions d'utilisation et la politique de confidentialité de Wema, puis accepte-les.",
    terms: (version: string) => `Conditions d'utilisation (version ${version})`,
    privacy: (version: string) =>
      `Politique de confidentialité (version ${version})`,
    checkbox:
      "J'ai lu et j'accepte les conditions d'utilisation et la politique de confidentialité.",
    submit: "Accepter et continuer",
    logout: "Me déconnecter",
  },
  status: {
    not_seen: "Non vue",
    needs_work: "À travailler",
    in_progress: "En cours",
    mastered: "Validé",
  },
  assignmentStatus: {
    todo: "À faire",
    late: "En retard",
    done: "Réussi",
    attempted: "Rendu",
    unavailable: "Bientôt disponible",
  },
  home: {
    hello: (name: string) => `Salut ${name} !`,
    description: "Voici où tu en es et ce qui t'attend.",
    nextStep: "Ta prochaine étape",
    nextEmpty:
      "Tout est à jour. Tu peux revoir une notion ou poser une question au prof IA.",
    otherActions: "Ensuite",
    upcoming: "Devoirs à venir",
    noUpcoming: "Aucun devoir à rendre pour l'instant.",
    allAssignments: "Voir tous les devoirs",
    nudges: "Messages pour toi",
    markRead: "J'ai lu",
    progress: "Ta progression",
    progressSummary: (
      mastered: number,
      inProgress: number,
      needsWork: number,
      total: number,
    ) =>
      `${mastered} ${plural(mastered, "validée", "validées")} · ${inProgress} en cours · ${needsWork} à travailler, sur ${total} ${plural(total, "notion", "notions")}`,
    seeProgress: "Voir mon chemin",
  },
  actions: {
    assignment_due: "Termine ton devoir",
    finish_exercise: "Fais ton exercice",
    start_notion: "Découvre une nouvelle notion",
    easy_win: "Reprends confiance",
    prerequisite_first: "Revois d'abord une notion de base",
    misconception_focus: "Corrige un petit piège",
    practice: "Entraîne-toi",
    spaced_review: "Petit rappel",
    intake: "Fais connaissance avec ton prof IA",
    go: {
      exercise: "Commencer l'exercice",
      tutor: "Ouvrir avec le prof IA",
      intake: "Commencer l'entretien",
    },
  },
  assignments: {
    title: "Mes devoirs",
    description: "Les exercices donnés par tes profs, avec leur échéance.",
    empty: "Tu n'as aucun devoir pour l'instant.",
    open: "Ouvrir",
    unavailableHint: "Ton prof prépare encore ton exercice.",
    groups: {
      late: "En retard",
      todo: "À faire",
      attempted: "Rendus",
      done: "Réussis",
      unavailable: "Bientôt disponibles",
    },
    otherExercises: "Autres exercices pour toi",
  },
  exercises: {
    title: "Exercice",
    level: (level: number) => `Niveau ${level}`,
    guided: "Pas à pas",
    notFound: "Cet exercice n'existe pas ou n'est plus disponible.",
    open: "Faire l'exercice",
    statement: "Énoncé",
    listen: "Écouter l'énoncé",
    steps: "Pas à pas",
    nextStep: "Montre-moi une étape",
    noMoreSteps: "Tu as vu toutes les étapes.",
    answer: "Ta réponse",
    answerHelp:
      "Écris ta réponse avec le clavier ou les touches mathématiques. Pour une équation, tu peux écrire par exemple x = 3.",
    answerPlaceholder: "Par exemple : x = 3",
    submit: "Vérifier ma réponse",
    checking: "Je vérifie…",
    correct: "Bravo, c'est juste !",
    correctHint: "Tu peux passer à la suite.",
    continue: "Continuer",
    notYet: "Pas encore",
    notYetHint:
      "Relis l'énoncé, regarde une étape ou demande un indice au prof IA.",
    wrongForm:
      "Ta valeur est bonne, mais pas encore écrite sous la forme demandée.",
    attemptsLeft: (count: number) =>
      count === 0
        ? "Il ne te reste aucun essai."
        : `Il te reste ${count} ${plural(count, "essai", "essais")}.`,
    noAttemptsLeft:
      "Tu as utilisé tous tes essais sur cet exercice. Le prof IA peut t'aider à comprendre.",
    alreadyDone: "Tu as déjà réussi cet exercice.",
    alreadyAttempted: "Tu as déjà rendu cet exercice.",
    askTutor: "Demander de l'aide au prof IA",
    explainOral: "Explique ta démarche",
    fromAssignment: (title: string) => `Devoir : ${title}`,
  },
  keyboard: {
    label: "Touches mathématiques",
    erase: "Effacer",
    or: "ou",
    sqrt: "Racine carrée",
    power: "Puissance",
    fraction: "Fraction",
  },
  photo: {
    title: "Ta feuille en photo",
    description:
      "Tu as fait l'exercice sur papier ? Envoie une photo de ta feuille : le prof IA lit ton raisonnement et te dit où ça coince, sans te donner la réponse.",
    takePhoto: "Prendre une photo",
    chooseImage: "Choisir une image",
    confirm: "Envoyer cette photo",
    retake: "Changer de photo",
    preparing: "Je prépare ta photo…",
    reading: "Le prof IA lit ta feuille…",
    privacy: "Ta photo sert seulement à la relecture : elle n'est pas gardée.",
    stepsTitle: "Ce que j'ai lu",
    stepCorrect: "Ça tient",
    stepStuck: "Ça coince ici",
    stepIncorrect: "À revoir",
    stepUnverified: "À vérifier : saisis ta réponse ci-dessus",
    issueTitle: "Où ça coince",
    noIssue:
      "Je ne vois pas d'erreur dans les étapes lues. Seule la vérification de ta réponse dira si c'est juste : saisis-la ci-dessus.",
    feedbackTitle: "Mon conseil",
    unreadable:
      "Je n'arrive pas à lire ta feuille. Reprends la photo bien à plat, avec de la lumière, en cadrant seulement ton exercice.",
    another: "Envoyer une autre photo",
    cameraDenied:
      "L'appareil photo n'est pas autorisé. Autorise-le dans les réglages de ton téléphone, ou choisis une image.",
    libraryDenied:
      "L'accès à tes photos n'est pas autorisé. Autorise-le dans les réglages de ton téléphone.",
  },
  tutor: {
    title: "Prof IA",
    description:
      "Pose tes questions, fais-toi aider sur un exercice ou explique une notion à ton tour.",
    newSession: "Nouvelle séance",
    mode: "Que veux-tu faire ?",
    notion: "Notion",
    exercise: "Exercice",
    choose: "Choisis…",
    noNotions:
      "Aucune notion disponible : tu n'es inscrit dans aucune classe pour l'instant.",
    noExercises: "Aucun exercice disponible pour ce mode.",
    start: "Commencer",
    sessions: "Mes séances",
    noSessions: "Tu n'as pas encore de séance.",
    finished: "Terminée",
    ongoing: "En cours",
    startedOn: (iso: string) => `Commencée le ${date(iso, true)}`,
    modes: {
      course_question: "J'ai une question de cours",
      exercise_help: "Aide-moi sur un exercice",
      teach_back: "Explique-moi : c'est moi qui enseigne",
      oral_check: "Je justifie ma démarche",
      intake: "Faisons connaissance",
    },
    modeHelp: {
      course_question: "Le prof IA t'explique une notion, à ton rythme.",
      exercise_help:
        "Le prof IA te guide par des questions et des indices, sans te donner la réponse.",
      teach_back:
        "Tu expliques la notion au prof IA, qui joue l'élève curieux.",
      oral_check: "Tu racontes comment tu as trouvé ta réponse.",
      intake:
        "Quelques questions pour que Wema comprenne comment tu aimes apprendre.",
    },
    chat: {
      you: "Toi",
      tutor: "Prof IA",
      placeholder: "Écris ton message…",
      placeholderOral: "Raconte comment tu as fait, étape par étape…",
      send: "Envoyer",
      sending: "Le prof IA réfléchit…",
      hint: "Demander un indice",
      hintsLeft: (count: number) =>
        count === 0
          ? "plus d'indice"
          : `${count} ${plural(count, "indice restant", "indices restants")}`,
      finish: "Terminer la séance",
      finished: "Cette séance est terminée.",
      assessment: (understanding: number, confidence: number) =>
        `Ce que le prof IA a retenu : compréhension ${understanding} %, confiance ${confidence} %.`,
      intakeDone: (count: number) =>
        count === 0
          ? "Merci ! Wema a noté tes réponses. Tu peux le voir dans ton profil."
          : `Merci ! Wema a noté ${count} ${plural(count, "chose", "choses")} sur toi. Tu peux le voir dans ton profil.`,
      seeProfile: "Voir mon profil",
      goExercise: "Revenir à l'exercice",
      listen: "Écouter",
      stop: "Arrêter",
      intro: {
        course_question:
          "Pose-moi ta question sur la notion : je t'explique avec des exemples, à ton rythme.",
        exercise_help:
          "Dis-moi où tu bloques sur cet exercice. Je ne te donnerai pas la réponse, mais je t'aide à la trouver.",
        teach_back:
          "Aujourd'hui, c'est toi le prof ! Explique-moi la notion comme si je n'en avais jamais entendu parler.",
        oral_check:
          "Explique-moi comment tu as trouvé ta réponse, étape par étape.",
        intake:
          "Salut ! Avant de commencer, j'aimerais mieux te connaître. Dis-moi bonjour pour démarrer.",
      },
    },
  },
  progress: {
    title: "Mon chemin",
    description:
      "Les notions de ton programme, dans l'ordre. Le pourcentage est une estimation de ta maîtrise.",
    empty:
      "Tu n'es inscrit dans aucune classe pour l'instant : ton chemin apparaîtra ici.",
    emptyClass: "Le programme de cette classe n'a pas encore de notions.",
    here: "Tu es ici",
    mastery: (value: number) => `${value} % estimé`,
    observations: (count: number) =>
      count === 0
        ? "Pas encore travaillée"
        : `${count} ${plural(count, "réponse", "réponses")}`,
    work: "Travailler cette notion",
  },
  profile: {
    title: "Mon profil",
    description:
      "Ce que Wema a compris de toi, et pourquoi. Tu peux corriger tes préférences quand tu veux.",
    understood: "Ce que Wema a compris de toi",
    noHypotheses:
      "Wema ne sait encore rien de tes façons d'apprendre. Fais l'entretien avec le prof IA ou choisis tes préférences ci-dessous.",
    startIntake: "Faire l'entretien",
    confidence: (value: number) => `Confiance : ${value} %`,
    evidence: (count: number) =>
      `${count} ${plural(count, "preuve", "preuves")}`,
    hypothesisStatus: {
      supported: "Plutôt vrai",
      contradicted: "Plutôt faux",
      uncertain: "Pas sûr",
    },
    sources: {
      declared_learner: "tu l'as dit",
      declared_guardian: "ton parent l'a dit",
      declared_teacher: "ton prof l'a dit",
      intake: "entretien avec le prof IA",
      measured: "mesuré sur tes exercices",
    },
    sourceLabel: (sources: string) => `D'où ça vient : ${sources}`,
    needs: "Adaptations prévues pour toi",
    preferences: "Mes préférences",
    preferencesHelp:
      "Dis à Wema comment tu aimes apprendre. Ton prof IA en tiendra compte.",
    prefs: {
      "format.scaffolded": "J'aime avancer par étapes guidées",
      "format.examples": "Je comprends mieux avec des exemples concrets",
      "format.visual": "Je comprends mieux avec des schémas",
      "format.comics": "J'aime apprendre avec des BD",
      "format.audio": "Je comprends mieux à l'oral",
      "pace.short_sessions": "Je préfère des séances courtes",
      "confidence.low": "Je manque un peu de confiance",
      "confidence.high": "J'ai confiance en moi",
    },
    interests: "Mes centres d'intérêt",
    interestsHelp: "Le prof IA pourra s'en servir dans ses exemples.",
    interestPlaceholder: "Par exemple : football, musique",
    addInterest: "Ajouter",
    removeInterest: (label: string) => `Retirer ${label}`,
    myPath: "Mon chemin",
    notifications: "Notifications",
    notificationsOn: "Les notifications sont activées sur ce téléphone.",
    notificationsOff:
      "Active les notifications pour recevoir les rappels de ton prof IA et les messages de tes profs.",
    notificationsEnable: "Activer les notifications",
    notificationsUnavailable:
      "Les notifications ne sont pas disponibles ici (simulateur ou Expo Go). Elles marcheront dans l'appli installée.",
    logout: "Me déconnecter",
  },
  messages: {
    title: "Messages",
    subtitle: "Écris à tes profs et lis leurs annonces.",
    empty: "Pas encore de message. Tu peux écrire à un de tes profs.",
    noContacts:
      "Tu n'as pas encore de prof à qui écrire : il faut d'abord être inscrit dans une classe.",
    new: "Nouveau message",
    newHint: "Tu peux écrire uniquement aux profs de tes classes.",
    to: "À qui ?",
    placeholder: "Écris ton message…",
    send: "Envoyer",
    sending: "Envoi…",
    readOnly: "Seul ton prof peut écrire ici.",
    closed: "Tu ne peux plus écrire dans cette conversation.",
    noMessages: "Aucun message pour l'instant.",
    you: "Toi",
    classThread: (name: string) => `Annonces · ${name}`,
    unread: (count: number) => `${count} ${plural(count, "non lu", "non lus")}`,
    relation: {
      learner: (className: string) => `Élève · ${className}`,
      teacher: (className: string) => `Prof · ${className}`,
    },
  },
  voice: {
    say: {
      sqrt: "racine carrée de",
      squared: "au carré",
      cubed: "au cube",
      times: "fois",
      approx: "environ",
    },
  },
  errors: {
    invalid_credentials:
      "Identifiant ou mot de passe incorrect. Vérifie et réessaie.",
    invalid_email: "Cette adresse e-mail n'est pas valide.",
    invalid_username: "Cet identifiant n'est pas valide.",
    too_many_attempts:
      "Trop d'essais. Attends un quart d'heure avant de réessayer.",
    ai_unavailable:
      "Le prof IA n'est pas disponible pour le moment. Réessaie un peu plus tard.",
    ai_not_configured:
      "Le prof IA n'est pas encore branché sur ce serveur. Tu pourras discuter avec lui bientôt.",
    ai_busy: "Le prof IA est très demandé. Réessaie dans un instant.",
    unreadable_answer:
      "Je n'arrive pas à lire ta réponse. Vérifie l'écriture (par exemple x = 3 ou 8,6) et réessaie : cet essai ne compte pas.",
    attempts_exhausted: "Tu as utilisé tous tes essais sur cet exercice.",
    math_unavailable:
      "La vérification n'est pas disponible pour le moment. Réessaie un peu plus tard.",
    session_finished:
      "Cette séance est terminée. Ouvre une nouvelle séance pour continuer.",
    session_too_long:
      "Cette séance est très longue : ouvre une nouvelle séance pour continuer.",
    too_many_messages:
      "Tu as envoyé beaucoup de messages. Fais une petite pause et réessaie dans quelques minutes.",
    hints_exhausted: "Tu as déjà eu tous les indices de cette séance.",
    hints_not_available: "Les indices sont réservés à l'aide sur un exercice.",
    no_answer_yet: "Réponds d'abord à l'exercice, puis explique ta démarche.",
    notion_required: "Choisis une notion.",
    invalid_preference: "Cette préférence n'est pas reconnue.",
    invalid_label: "Écris seulement quelques mots, avec des lettres.",
    photo_too_large:
      "Ta photo est trop lourde (5 Mo au plus). Reprends-la ou choisis une image plus légère.",
    photo_unsupported_format:
      "Ce format d'image n'est pas lu. Envoie une photo en JPEG, PNG ou WebP.",
    photo_missing: "Choisis d'abord une photo.",
    too_many_photos:
      "Tu as envoyé beaucoup de photos. Fais une petite pause et réessaie dans quelques minutes.",
    forbidden:
      "Ce message ne peut pas être envoyé : le lien avec cette personne n'existe plus.",
    unauthenticated: "Ta session a expiré. Reconnecte-toi.",
    bad_origin: "Le serveur a refusé la demande. Mets l'appli à jour.",
    not_found: "Introuvable : cet élément n'existe plus.",
    network:
      "Le serveur ne répond pas. Vérifie ta connexion et l'adresse du serveur, puis réessaie.",
    terms_outdated:
      "Les conditions viennent de changer. Relis la nouvelle version, puis accepte-la.",
    generic: "Oups, quelque chose n'a pas marché. Réessaie.",
  },
};

export const m = fr;

/** Message d'erreur tutoyé pour un code de l'API (« generic » si inconnu). */
export function errorMessage(code: string): string {
  const known = Object.entries(fr.errors).find(([key]) => key === code);
  return known ? known[1] : fr.errors.generic;
}

# Lot 10 · Wema de bout en bout

**Objectif :** un produit qui fonctionne entièrement, avec la vraie IA. Demandé par Olivier le 3 novembre 2026 : « finis tout le projet ». Ce lot est sur la branche `lot-09-front-end`.

## Livré

- **IA :** Claude Haiku 5.5 par défaut, via OpenRouter (choix d'Olivier), réglable dans `/admin/ia`.
  - La passerelle n'envoie pas de température pour une sortie structurée : OpenRouter la refuse pour ce modèle.
  - Elle accepte des images.
- **Banque de la semaine proposée par l'IA :**
  - les propositions sont vérifiées par `services/math` ;
  - un bouton dans `/prof/banque` permet d'en demander ;
  - un passage automatique a lieu chaque semaine.
- **Prof IA réel, dans ses 5 modes :**
  - la réponse s'affiche au fil de l'eau ;
  - le résumé d'évaluation est neutre et ne donne jamais la solution ;
  - le banc d'essai `evals/` est à 21 sur 21 avec le vrai modèle.
- **Voix dans le navigateur :** « Écouter » (synthèse vocale) et « Dicter » (reconnaissance vocale). Ce n'est pas un modèle d'IA de Wema.
- **Photo de copie :** `POST /api/learner/variants/:id/photo`. L'IA lit les étapes et donne un indice ; la photo n'est jamais conservée.
- **Messagerie :** prof ↔ élève, prof ↔ parent, annonces de classe (migration 0016).
- **Recette complète dans le navigateur**, avec tous les bugs trouvés corrigés :
  - parcours de tous les rôles, au format mobile et en thème sombre ;
  - pages 404 et page d'erreur ;
  - manifeste PWA (installation sur téléphone) ;
  - page du routage IA.

## À trancher par Olivier

- **Dictée :** dans Chrome, l'audio part chez Google. La garder pour des mineurs, ou passer par un service de transcription choisi par Wema ?
- **Données de santé :** le parent voit les déclarations en attente de son consentement (fiche 0006 complétée).
- **Messagerie :**
  - un élève ne peut pas écrire à son propre parent ;
  - les parents ne reçoivent pas les annonces de classe.

## Reste hors du produit

- L'application mobile native (le site s'installe sur téléphone).
- L'envoi des relances et des codes par SMS, WhatsApp ou e-mail : il faut un prestataire.
- La facturation.
- Le design final.

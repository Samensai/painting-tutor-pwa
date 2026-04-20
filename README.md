# Painting Tutor PWA

Premier MVP web mobile pour valider une app de tutoriels de peinture a partir d'une image de reference.

## Inclus dans cette version

- import d'image de reference
- choix du medium huile ou acrylique
- saisie d'une palette de tubes disponible
- generation d'un plan de peinture progressif en plusieurs etapes
- suggestions de recettes de melange a partir des tubes les plus proches
- structure PWA avec manifest et service worker
- sauvegarde locale de la palette, de l'image et de la progression
- point d'entree pour un backend de segmentation configure par URL
- dossier `backend/` pret pour l'option `PWA + backend`

## Limites actuelles

- les etapes restent generees localement par heuristiques visuelles
- le backend fourni est une base `SAM 2 ready`, pas encore une integration complete du modele
- les melanges sont une estimation simple par proximite de couleur

## Lancer le projet

Ouvre `index.html` dans un navigateur moderne, ou sers le dossier avec un petit serveur local pour profiter completement du mode PWA.

## Architecture

- `index.html`, `styles.css`, `app.js` : PWA mobile
- `backend/` : API FastAPI pour preparer la segmentation serveur

## Prochaines etapes recommandees

1. Brancher un vrai adaptateur `SAM 2` dans `backend/app/segmenter.py`
2. Renvoyer de vrais masques de regions au frontend
3. Construire les etapes de peinture a partir de ces masques
4. Ajouter des overlays interactifs sur l'image

# Backend SAM 2 Ready

Ce dossier prepare l'option `PWA + backend` pour la segmentation d'image.

## Role du backend

Le backend recevra l'image de reference depuis la PWA puis renverra une analyse plus solide que les heuristiques locales :

- fond
- sujet principal
- formes secondaires
- zones d'ombre
- zones de detail
- boite du sujet principal

Dans cette version, le serveur :

- essaye d'utiliser `SAM 2` si ses dependances et son checkpoint sont disponibles
- retombe automatiquement sur une analyse heuristique si `SAM 2` n'est pas pret

Le frontend peut donc etre branche tout de suite, meme avant l'installation complete du modele.

## API exposee

- `GET /health`
- `POST /api/v1/segment`

### Requete

```json
{
  "imageDataUrl": "data:image/jpeg;base64,...",
  "medium": "oil",
  "palette": [
    { "name": "Blanc de titane", "pigment": "PW6", "color": "#f4f1e8" }
  ]
}
```

### Reponse

```json
{
  "provider": "fallback-segmenter",
  "analysis": {
    "backgroundSummary": "Grandes zones lointaines et peu detaillees.",
    "backgroundCoverage": "45% a 60%",
    "subjectSummary": "Forme dominante la plus lisible de l'image.",
    "subjectCoverage": "20% a 35%",
    "secondarySummary": "Objets d'accompagnement et plans intermediaires.",
    "secondaryCoverage": "15% a 25%",
    "shadowSummary": "Grandes ombres et rapports de recouvrement.",
    "shadowCoverage": "15% a 30%",
    "detailSummary": "Petites zones de contraste, aretes et textures.",
    "detailCoverage": "moins de 12%",
    "secondaryLabel": "Couleur secondaire moyenne",
    "midtoneLabel": "Valeur moyenne dominante",
    "detailLabel": "Couleur des details structurants",
    "secondaryColorHex": "#7b6e53",
    "midtoneHex": "#a48b62",
    "detailColorHex": "#34271d",
    "subjectBox": { "x": 0.5, "y": 0.5, "rx": 0.22, "ry": 0.28 }
  }
}
```

## Lancer localement

1. Creer un environnement virtuel Python
2. Installer les dependances
3. Lancer `uvicorn`

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Le frontend peut alors pointer vers `http://localhost:8000`.

## Variables d'environnement

Copie [.env.example](/C:/Users/sam22/OneDrive/Documents/New%20project/painting-tutor-pwa/backend/.env.example) puis renseigne :

- `SAM2_CHECKPOINT` : chemin vers le checkpoint `SAM 2.1`
- `SAM2_MODEL_CFG` : config du modele
- `SAM2_DEVICE` : `cpu`, `cuda` ou autre device PyTorch adapte

## Installer SAM 2 ensuite

Le code backend est pret pour un import du package `sam2`, mais cette installation n'est pas faite automatiquement ici.

Points importants d'apres la doc officielle :

- `SAM 2` demande `python>=3.10`, `torch>=2.3.1` et `torchvision>=0.18.1`
- Meta recommande fortement `WSL + Ubuntu` si tu es sur Windows
- il faut telecharger un checkpoint `SAM 2.1`
- l'API image officielle repose sur `build_sam2(...)` et `SAM2AutomaticMaskGenerator(...)`

Sources officielles :

- [README officiel SAM 2](https://github.com/facebookresearch/sam2)
- [Guide PyTorch officiel](https://pytorch.org/)
- [WSL Ubuntu sur Windows](https://learn.microsoft.com/windows/wsl/)

## Suite recommandee

1. Installer `SAM 2` et verifier que `GET /health` passe en provider `sam2`
2. Ajouter des masques par region, pas seulement des resumes
3. Renvoyer des overlays et non seulement une `subjectBox`
4. Generer les etapes de peinture a partir des regions segmentees

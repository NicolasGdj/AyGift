export const defaultSettings = {
  colors: { accent: '#713c58', background: '#f7f5fa', surface: '#ffffff', text: '#241c2b', reservation: '#21665a' },
  categoryOrder: [],
  categoryLayout: 'bar',
  catalogLayout: 'grid',
  featuredEnabled: false,
  featuredLimit: 3,
  featuredIds: [],
  recentLimit: 6,
  sizes: [],
  favoriteColors: [],
  avoidEnabled: false,
  avoidIntro: '',
  avoidGroups: [],
  rouletteEnabled: false,
  welcome: {
    siteName: 'AyGift',
    ownerName: '',
    title: '',
    description: 'Des idées cadeaux à retrouver pour la prochaine occasion.',
    guestButton: 'Voir la liste de cadeaux',
    adminButton: 'Accès administrateur',
    loginTitle: 'Connexion admin',
    loginDescription: ''
  }
};

export const maxFeaturedLimit = 30;
export const maxFeaturedIds = 200;
export const maxPreferenceRows = 30;

export function publicSiteSettings(settings) {
  if (settings.avoidEnabled) return settings;
  const { avoidIntro, avoidGroups, ...published } = settings;
  return published;
}

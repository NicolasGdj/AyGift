import { DataTypes } from 'sequelize';
import sequelize from './db.js';
import { defaultSettings } from '../public/js/settings.js';

export const SiteSettings = sequelize.define('SiteSettings', {
  id: { type: DataTypes.INTEGER, primaryKey: true },
  settings: { type: DataTypes.JSON, allowNull: false }
}, { tableName: 'site_settings', timestamps: false });

export async function readSiteSettings() {
  const row = await SiteSettings.findByPk(1);
  const saved = row?.settings;
  return {
    ...defaultSettings,
    ...saved,
    colors: { ...defaultSettings.colors, ...saved?.colors },
    welcome: { ...defaultSettings.welcome, ...saved?.welcome }
  };
}

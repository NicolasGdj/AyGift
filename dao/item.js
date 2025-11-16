import { DataTypes } from 'sequelize';
import sequelize from './db.js';
import Category from './category.js';

const Item = sequelize.define('Item', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  category_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Category,
      key: 'id'
    }
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  last_interest_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  link: {
    type: DataTypes.STRING,
    allowNull: true
  },
  image: {
    type: DataTypes.STRING,
    allowNull: true
  },
  owned: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'items',
  timestamps: true
});

Item.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });
Category.hasMany(Item, { foreignKey: 'category_id', as: 'items' });

export default Item;

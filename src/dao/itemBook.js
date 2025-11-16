import { DataTypes } from 'sequelize';
import sequelize from './db.js';
import Item from './item.js';

const ItemBook = sequelize.define('ItemBook', {
  item_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    references: {
      model: Item,
      key: 'id'
    }
  },
  user: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false
  },
  date: {
    type: DataTypes.DATE,
    primaryKey: true,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'item_books',
  timestamps: false
});

ItemBook.belongsTo(Item, { foreignKey: 'item_id', as: 'item' });
Item.hasMany(ItemBook, { foreignKey: 'item_id', as: 'bookings' });

export default ItemBook;

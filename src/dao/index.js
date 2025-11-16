import sequelize from './db.js';
import Category from './category.js';
import Item from './item.js';
import ItemBook from './itemBook.js';

const syncDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
    await sequelize.sync({ alter: false });
    console.log('Database synchronized.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
};

export { sequelize, Category, Item, ItemBook, syncDatabase };

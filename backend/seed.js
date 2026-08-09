import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Owner from './src/models/Owner.js';
import Restaurant from './src/models/Restaurant.js';
import Food from './src/models/Food.js';
import Table from './src/models/Table.js';
import Menu from './src/models/Menu.js';

dotenv.config();

const seedDatabase = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Clear existing data
    await Owner.deleteMany({});
    await Restaurant.deleteMany({});
    await Food.deleteMany({});
    await Table.deleteMany({});
    await Menu.deleteMany({});
    console.log('🗑️  Cleared existing data');
    
    // Create owner
    const owner = await Owner.create({
      username: 'admin',
      password: 'admin123'
    });
    console.log('👤 Created owner:', owner.username);
    
    // Create restaurant
    const restaurant = await Restaurant.create({
      owner: owner._id,
      name: 'The Hungry Kitchen',
      description: 'Experience authentic flavors and culinary excellence at The Hungry Kitchen. We serve the finest dishes made with fresh, locally-sourced ingredients.',
      phone: '+880-1712-345678',
      email: 'info@hungrykitchen.com',
      address: {
        street: '123 Food Street',
        city: 'Dhaka',
        state: 'Dhaka',
        zipCode: '1205',
        country: 'Bangladesh'
      },
      openingHours: {
        monday: { open: '11:00 AM', close: '11:00 PM' },
        tuesday: { open: '11:00 AM', close: '11:00 PM' },
        wednesday: { open: '11:00 AM', close: '11:00 PM' },
        thursday: { open: '11:00 AM', close: '11:00 PM' },
        friday: { open: '11:00 AM', close: '11:00 PM' },
        saturday: { open: '11:00 AM', close: '12:00 AM' },
        sunday: { open: '11:00 AM', close: '12:00 AM' }
      }
    });
    console.log('🏪 Created restaurant:', restaurant.name);
    
    // Create foods
    const foods = await Food.insertMany([
      {
        restaurant: restaurant._id,
        name: 'Chicken Biryani',
        description: 'Aromatic basmati rice cooked with tender chicken pieces and traditional spices',
        price: 350,
        category: 'Main Course',
        isVegetarian: false,
        isAvailable: true,
        isBadge: true,
        preparationTime: 30,
        spiceLevel: 'Medium',
        image: '/uploads/food-biryani.jpg'
      },
      {
        restaurant: restaurant._id,
        name: 'Beef Burger',
        description: 'Juicy beef patty with fresh vegetables and special sauce',
        price: 250,
        category: 'Main Course',
        isVegetarian: false,
        isAvailable: true,
        preparationTime: 15,
        spiceLevel: 'Mild',
        image: '/uploads/food-burger.jpg'
      },
      {
        restaurant: restaurant._id,
        name: 'Vegetable Samosa',
        description: 'Crispy pastry filled with spiced potatoes and peas',
        price: 60,
        category: 'Appetizer',
        isVegetarian: true,
        isAvailable: true,
        isBadge: true,
        preparationTime: 10,
        spiceLevel: 'Mild',
        image: '/uploads/food-samosa.jpg'
      },
      {
        restaurant: restaurant._id,
        name: 'Butter Chicken',
        description: 'Creamy tomato-based curry with tender chicken pieces',
        price: 280,
        category: 'Main Course',
        isVegetarian: false,
        isAvailable: true,
        preparationTime: 25,
        spiceLevel: 'Mild',
        image: '/uploads/food-butter-chicken.jpg'
      },
      {
        restaurant: restaurant._id,
        name: 'Chocolate Lava Cake',
        description: 'Warm chocolate cake with a molten center, served with vanilla ice cream',
        price: 200,
        category: 'Dessert',
        isVegetarian: true,
        isAvailable: true,
        isBadge: true,
        preparationTime: 15,
        spiceLevel: 'None',
        image: '/uploads/food-lava-cake.jpg'
      },
      {
        restaurant: restaurant._id,
        name: 'Mango Lassi',
        description: 'Chilled yogurt drink blended with fresh mangoes',
        price: 80,
        category: 'Beverage',
        isVegetarian: true,
        isAvailable: true,
        preparationTime: 5,
        spiceLevel: 'None',
        image: '/uploads/food-mango-lassi.jpg'
      },
      {
        restaurant: restaurant._id,
        name: 'Hilsa Fish Curry',
        description: 'Bengali-style hilsa fish cooked in mustard oil with mustard paste',
        price: 400,
        category: 'Main Course',
        isVegetarian: false,
        isAvailable: true,
        preparationTime: 25,
        spiceLevel: 'Medium',
        image: '/uploads/food-hilsa.jpg'
      },
      {
        restaurant: restaurant._id,
        name: 'French Fries',
        description: 'Crispy golden fries seasoned with salt and pepper',
        price: 90,
        category: 'Snack',
        isVegetarian: true,
        isAvailable: true,
        preparationTime: 10,
        spiceLevel: 'None',
        image: '/uploads/food-fries.jpg'
      },
      {
        restaurant: restaurant._id,
        name: 'Chicken Tikka',
        description: 'Tender chicken marinated in yogurt and spices, grilled to perfection',
        price: 180,
        category: 'Appetizer',
        isVegetarian: false,
        isAvailable: true,
        preparationTime: 20,
        spiceLevel: 'Medium',
        image: '/uploads/food-chicken-tikka.jpg'
      },
      {
        restaurant: restaurant._id,
        name: 'Vegetable Curry',
        description: 'Mixed seasonal vegetables cooked in a rich spiced gravy',
        price: 160,
        category: 'Main Course',
        isVegetarian: true,
        isAvailable: true,
        preparationTime: 20,
        spiceLevel: 'Medium',
        image: '/uploads/food-veg-curry.jpg'
      },
      {
        restaurant: restaurant._id,
        name: 'Gulab Jamun',
        description: 'Soft milk-solid dumplings soaked in rose-flavoured sugar syrup',
        price: 80,
        category: 'Dessert',
        isVegetarian: true,
        isAvailable: true,
        preparationTime: 5,
        spiceLevel: 'None',
        image: '/uploads/food-gulab-jamun.jpg'
      },
      {
        restaurant: restaurant._id,
        name: 'Cold Coffee',
        description: 'Blended iced coffee with milk and a touch of chocolate syrup',
        price: 100,
        category: 'Beverage',
        isVegetarian: true,
        isAvailable: true,
        preparationTime: 5,
        spiceLevel: 'None',
        image: '/uploads/food-cold-coffee.jpg'
      }
    ]);
    console.log(`🍕 Created ${foods.length} food items`);
    
    // Create tables
    const tables = await Table.insertMany([
      {
        restaurant: restaurant._id,
        tableNumber: 'T-01',
        capacity: 2,
        location: 'Window Side'
      },
      {
        restaurant: restaurant._id,
        tableNumber: 'T-02',
        capacity: 4,
        location: 'Main Hall'
      },
      {
        restaurant: restaurant._id,
        tableNumber: 'T-03',
        capacity: 4,
        location: 'Main Hall'
      },
      {
        restaurant: restaurant._id,
        tableNumber: 'T-04',
        capacity: 6,
        location: 'Private Room'
      },
      {
        restaurant: restaurant._id,
        tableNumber: 'T-05',
        capacity: 2,
        location: 'Terrace'
      },
      {
        restaurant: restaurant._id,
        tableNumber: 'Takeout',
        uniqueUrl: 'takeout',
        capacity: 1,
        location: 'Takeout'
      }
    ]);
    console.log(`🪑 Created ${tables.length} tables`);

    // Create menus
    const byCategory = (cat) => foods.filter(f => f.category === cat).map(f => f._id);
    const menus = await Menu.insertMany([
      {
        restaurant: restaurant._id,
        name: 'All Day Menu',
        description: 'Full menu available throughout the day.',
        foods: foods.map(f => f._id),
        displayOrder: 0,
        availableDays: ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
      },
      {
        restaurant: restaurant._id,
        name: 'Lunch Special',
        description: 'Main courses available at lunchtime.',
        foods: [...byCategory('Main Course'), ...byCategory('Snack')],
        displayOrder: 1,
        availableFrom: '12:00',
        availableTo: '15:00',
        availableDays: ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
      },
      {
        restaurant: restaurant._id,
        name: 'Drinks & Desserts',
        description: 'Beverages and desserts available all day.',
        foods: [...byCategory('Beverage'), ...byCategory('Dessert')],
        displayOrder: 2,
        availableDays: ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
      }
    ]);
    console.log(`📋 Created ${menus.length} menus`);

    console.log('');
    console.log('✅ Database seeded successfully!');
    console.log('');
    console.log('🔐 Login Credentials:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('');
    console.log('🔑 Master Password: AdminMaster@123');
    console.log('');
    console.log('📋 Sample Table URLs:');
    for (const table of tables) {
      console.log(`   ${table.tableNumber}: http://localhost:7878/api/public/table/${table.uniqueUrl}`);
    }
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();

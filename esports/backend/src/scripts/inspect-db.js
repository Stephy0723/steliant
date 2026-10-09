import 'dotenv/config'
import mongoose from 'mongoose'
import { config } from '../config/index.js'

async function run() {
  console.log(`Connecting to ${config.mongoUri}...`);
  await mongoose.connect(config.mongoUri);

  const db = mongoose.connection.db;

  const collections = await db.listCollections().toArray();
  console.log('Collections in database:', collections.map(c => c.name));

  const usersCount = await db.collection('users').countDocuments();
  const brandsCount = await db.collection('brands').countDocuments();
  const invoicesCount = await db.collection('invoices').countDocuments();
  const ticketsCount = await db.collection('tickets').countDocuments();

  console.log(`Users: ${usersCount}`);
  console.log(`Brands: ${brandsCount}`);
  console.log(`Invoices: ${invoicesCount}`);
  console.log(`Tickets: ${ticketsCount}`);

  if (invoicesCount > 0) {
    const invoices = await db.collection('invoices').find().limit(2).toArray();
    console.log('Invoices sample:', JSON.stringify(invoices, null, 2));
  }

  if (ticketsCount > 0) {
    const tickets = await db.collection('tickets').find().limit(2).toArray();
    console.log('Tickets sample:', JSON.stringify(tickets, null, 2));
  }

  await mongoose.disconnect();
}

run().catch(console.error);

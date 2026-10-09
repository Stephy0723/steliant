import 'dotenv/config'
import mongoose from 'mongoose'
import { config } from '../config/index.js'
import { Invoice } from '../models/Invoice.js'
import { Ticket } from '../models/Ticket.js'

async function run() {
  await mongoose.connect(config.mongoUri);

  const invoices = await Invoice.find().populate('brandId campaignId').lean();
  console.log('All Invoices:', invoices.map(i => ({
    id: i._id,
    invoiceNumber: i.invoiceNumber,
    brandName: i.brandId?.name,
    campaignName: i.campaignId?.name,
    amount: i.amount,
    status: i.status
  })));

  const tickets = await Ticket.find().populate('brandId').lean();
  console.log('All Tickets:', tickets.map(t => ({
    id: t._id,
    publicCode: t.publicCode,
    brandName: t.brandId?.name,
    subject: t.subject,
    status: t.status
  })));

  await mongoose.disconnect();
}

run().catch(console.error);

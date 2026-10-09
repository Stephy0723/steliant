import 'dotenv/config'
import { connectDatabase, disconnectDatabase } from '../database/mongo.js'
import { Brand } from '../models/Brand.js'
import { Counter } from '../models/Counter.js'
import { Invoice } from '../models/Invoice.js'
import { createBrandCode, createInvoiceNumber } from '../services/codes.service.js'

function numericTail(value, pattern) {
  const match = pattern.exec(String(value || ''))
  return match ? Number(match[1]) : 0
}

async function initializeCounters() {
  const brands = await Brand.find().select('code').lean()
  const brandMax = Math.max(0, ...brands.map(brand => numericTail(brand.code, /^BRD-(\d+)$/)))
  await Counter.updateOne({ key: 'brand' }, { $max: { value: brandMax } }, { upsert: true })

  const invoices = await Invoice.find().select('invoiceNumber createdAt').lean()
  const maxByYear = new Map()
  for (const invoice of invoices) {
    const match = /^INV-(\d{4})-(\d+)$/.exec(String(invoice.invoiceNumber || ''))
    if (!match) continue
    const year = Number(match[1])
    maxByYear.set(year, Math.max(maxByYear.get(year) || 0, Number(match[2])))
  }
  for (const [year, value] of maxByYear) {
    await Counter.updateOne({ key: `invoice:${year}` }, { $max: { value } }, { upsert: true })
  }
}

async function backfillCodes() {
  await connectDatabase()
  await initializeCounters()

  const brands = await Brand.find({ $or: [{ code: { $exists: false } }, { code: '' }] }).sort({ createdAt: 1, _id: 1 })
  for (const brand of brands) {
    const code = await createBrandCode()
    await Brand.collection.updateOne({ _id: brand._id }, { $set: { code } })
    console.log(`${brand.name}: ${code}`)
  }

  const invoices = await Invoice.find({ $or: [{ invoiceNumber: { $exists: false } }, { invoiceNumber: '' }] }).sort({ createdAt: 1, _id: 1 })
  for (const invoice of invoices) {
    const invoiceNumber = await createInvoiceNumber(invoice.createdAt)
    await Invoice.collection.updateOne({ _id: invoice._id }, { $set: { invoiceNumber } })
    console.log(`Factura ${invoice._id}: ${invoiceNumber}`)
  }

  await Brand.collection.createIndex({ code: 1 }, { unique: true, name: 'code_1' })
  await Invoice.collection.createIndex({ invoiceNumber: 1 }, { unique: true, name: 'invoiceNumber_1' })
  console.log(`Migración completa: ${brands.length} marca(s), ${invoices.length} factura(s).`)
}

backfillCodes()
  .catch(error => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(disconnectDatabase)

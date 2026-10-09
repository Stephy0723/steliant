import 'dotenv/config'
import mongoose from 'mongoose'
import { config } from '../config/index.js'
import { Brand } from '../models/Brand.js'
import { Campaign } from '../models/Campaign.js'
import { User } from '../models/User.js'
import { Invoice } from '../models/Invoice.js'
import { Ticket } from '../models/Ticket.js'

async function run() {
  console.log(`Connecting to ${config.mongoUri}...`);
  await mongoose.connect(config.mongoUri);

  // Clear existing seeded invoices and tickets (leaving real ones intact)
  await Invoice.deleteMany({ seed: true });
  await Ticket.deleteMany({ seed: true });

  const brands = await Brand.find();
  const users = await User.find({ role: { $in: ['player', 'user'] } }).limit(10);
  const admins = await User.find({ role: 'admin' });

  if (!brands.length) {
    console.error('No brands found in DB. Please seed brands first.');
    await mongoose.disconnect();
    return;
  }

  if (!users.length) {
    console.error('No users found in DB.');
    await mongoose.disconnect();
    return;
  }

  const adminUser = admins[0] || users[0]; // fallback if no admin

  console.log(`Found ${brands.length} brands, ${users.length} users, and ${admins.length} admins.`);

  // 1. Seed some campaigns if they are few
  let campaigns = await Campaign.find();
  if (campaigns.length < 5) {
    console.log('Seeding demo campaigns...');
    const demoCampaigns = [
      {
        brandId: brands[0]._id,
        name: 'Federacion Dominicana de Videojuegos - Copa Nacional',
        budget: 1500,
        status: 'active',
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-30'),
        payment: { status: 'verified', amount: 1500 }
      },
      {
        brandId: brands[1]._id,
        name: 'NPC Latino - Cobertura editorial',
        budget: 3500,
        status: 'active',
        startDate: new Date('2026-06-10'),
        endDate: new Date('2026-07-10'),
        payment: { status: 'verified', amount: 3500 }
      },
      {
        brandId: brands[2]._id,
        name: 'Federacion Dominicana de Videojuegos - Clasificatorio',
        budget: 800,
        status: 'pending',
        startDate: new Date('2026-07-01'),
        endDate: new Date('2026-07-15'),
        payment: { status: 'pending', amount: 800 }
      },
      {
        brandId: brands[3]._id,
        name: 'NPC Latino - Comunidad',
        budget: 1200,
        status: 'active',
        startDate: new Date('2026-06-15'),
        endDate: new Date('2026-07-15'),
        payment: { status: 'rejected', amount: 1200 }
      },
      {
        brandId: brands[4]._id,
        name: 'Federacion Dominicana de Videojuegos - Activacion',
        budget: 2500,
        status: 'pending',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-15'),
        payment: { status: 'pending', amount: 2500 }
      }
    ];

    campaigns = await Campaign.insertMany(demoCampaigns);
    console.log(`Seeded ${campaigns.length} campaigns.`);
  }

  // 2. Seed Invoices
  console.log('Seeding invoices...');
  const invoicesData = [
    {
      seed: true,
      brandId: brands[0]._id,
      campaignId: campaigns[0]._id,
      invoiceNumber: 'INV-2026-0002',
      amount: 1500,
      currency: 'USD',
      proofUrl: 'https://example.com/receipts/hyperx-arena.pdf',
      proofType: 'transfer',
      brandNotes: 'Transferencia bancaria por patrocinio de arena.',
      status: 'verified',
      approvedBy: adminUser._id,
      approvedAt: new Date('2026-06-02'),
      adminNotes: 'Pago verificado en la cuenta del banco.'
    },
    {
      seed: true,
      brandId: brands[1]._id,
      campaignId: campaigns[1]._id,
      invoiceNumber: 'INV-2026-0003',
      amount: 3500,
      currency: 'USD',
      proofUrl: 'https://example.com/receipts/redbull-boost.pdf',
      proofType: 'card',
      brandNotes: 'Cargo automático a tarjeta corporativa.',
      status: 'verified',
      approvedBy: adminUser._id,
      approvedAt: new Date('2026-06-11'),
      adminNotes: 'Aprobación automática de pasarela.'
    },
    {
      seed: true,
      brandId: brands[2]._id,
      campaignId: campaigns[2]._id,
      invoiceNumber: 'INV-2026-0004',
      amount: 800,
      currency: 'USD',
      proofUrl: 'https://example.com/receipts/logi-pro.png',
      proofType: 'transfer',
      brandNotes: 'Comprobante adjunto. Favor aprobar.',
      status: 'pending',
      adminNotes: ''
    },
    {
      seed: true,
      brandId: brands[3]._id,
      campaignId: campaigns[3]._id,
      invoiceNumber: 'INV-2026-0005',
      amount: 1200,
      currency: 'USD',
      proofUrl: 'https://example.com/receipts/corsair-rgb.png',
      proofType: 'card',
      brandNotes: 'Intento de pago de patrocinio.',
      status: 'rejected',
      rejectedReason: 'Fondos insuficientes en la tarjeta.',
      adminNotes: 'El banco rechazó la transacción.'
    },
    {
      seed: true,
      brandId: brands[4]._id,
      campaignId: campaigns[4]._id,
      invoiceNumber: 'INV-2026-0006',
      amount: 2500,
      currency: 'USD',
      proofUrl: 'https://example.com/receipts/secretlab-chairs.pdf',
      proofType: 'transfer',
      brandNotes: 'Transferencia desde cuenta en Singapur.',
      status: 'pending',
      adminNotes: ''
    }
  ];

  await Invoice.insertMany(invoicesData);
  console.log('Seeded 5 invoices.');

  // 3. Seed Support Tickets
  console.log('Seeding support tickets...');
  const ticketsData = [
    {
      seed: true,
      publicCode: 'TCK-2026-HX01',
      internalCode: 'INT-TCK-HX01',
      brandId: brands[0]._id,
      authorId: users[0]._id,
      subject: 'Problema al subir banner publicitario',
      category: 'creative',
      status: 'open',
      priority: 'high',
      unreadByAdmin: 1,
      unreadByBrand: 0,
      messages: [
        {
          author: 'brand',
          authorId: users[0]._id,
          body: 'Hola equipo GlitchGang, estamos intentando subir nuestro banner para la campana de Federacion Dominicana de Videojuegos pero la plataforma nos indica un error de dimensiones. Nos pueden asistir?',
          sentAt: new Date('2026-06-22T10:00:00Z')
        }
      ]
    },
    {
      seed: true,
      publicCode: 'TCK-2026-RB02',
      internalCode: 'INT-TCK-RB02',
      brandId: brands[1]._id,
      authorId: users[1]._id,
      subject: 'Solicitud de factura fiscal (comprobante fiscal)',
      category: 'billing',
      status: 'in_progress',
      priority: 'medium',
      unreadByAdmin: 0,
      unreadByBrand: 1,
      assignedTo: adminUser._id,
      messages: [
        {
          author: 'brand',
          authorId: users[1]._id,
          body: 'Estimados, requerimos una factura con comprobante fiscal (NCF) para el pago del patrocinio de NPC Latino. ¿Dónde podemos ingresar el RNC de la empresa?',
          sentAt: new Date('2026-06-20T14:30:00Z')
        },
        {
          author: 'admin',
          authorId: adminUser._id,
          body: 'Hola NPC Latino, con gusto. Pueden enviarnos los datos fiscales (RNC, Razón Social) por este medio y nosotros generamos el comprobante fiscal correspondiente de inmediato.',
          sentAt: new Date('2026-06-20T16:00:00Z')
        }
      ]
    },
    {
      seed: true,
      publicCode: 'TCK-2026-LG03',
      internalCode: 'INT-TCK-LG03',
      brandId: brands[2]._id,
      authorId: users[2]._id,
      subject: 'Error técnico en el registro de torneos sponsoreables',
      category: 'technical',
      status: 'closed',
      priority: 'low',
      unreadByAdmin: 0,
      unreadByBrand: 0,
      assignedTo: adminUser._id,
      closedAt: new Date('2026-06-19'),
      messages: [
        {
          author: 'brand',
          authorId: users[2]._id,
          body: 'No nos aparece el torneo "GG Spring Split" en la lista de patrocinables.',
          sentAt: new Date('2026-06-18T09:00:00Z')
        },
        {
          author: 'admin',
          authorId: adminUser._id,
          body: 'Hola Federacion Dominicana de Videojuegos. El torneo ya había cerrado su ventana de patrocinios, pero hemos extendido el plazo 24 horas más para que puedan completar su aplicación.',
          sentAt: new Date('2026-06-18T11:00:00Z')
        },
        {
          author: 'brand',
          authorId: users[2]._id,
          body: '¡Excelente! Ya pudimos aplicar correctamente. Muchas gracias.',
          sentAt: new Date('2026-06-18T12:00:00Z')
        }
      ]
    },
    {
      seed: true,
      publicCode: 'TCK-2026-CS04',
      internalCode: 'INT-TCK-CS04',
      brandId: brands[3]._id,
      authorId: users[3]._id,
      subject: 'Aprobación de campaña retrasada',
      category: 'campaign',
      status: 'open',
      priority: 'medium',
      unreadByAdmin: 1,
      unreadByBrand: 0,
      messages: [
        {
          author: 'brand',
          authorId: users[3]._id,
          body: 'Nuestra campana NPC Latino Comunidad ha estado en estado pendiente por mas de 3 dias habiles. Cuando se completara la revision?',
          sentAt: new Date('2026-06-23T15:00:00Z')
        }
      ]
    }
  ];

  await Ticket.insertMany(ticketsData);
  console.log('Seeded 4 support tickets.');

  await mongoose.disconnect();
  console.log('Seeding completed successfully!');
}

run().catch(console.error);

import {
  PrismaClient,
  ProductApprovalStatus,
  ProductStatus,
  UserRole,
  UserStatus,
  VerificationStatus,
} from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const password = await argon2.hash('ChangeMe123!');

  // --- ADMIN ---
  await prisma.user.upsert({
    where: { email: 'admin@wask.io' },
    update: {},
    create: {
      firstName: 'Wask',
      lastName: 'Admin',
      email: 'admin@wask.io',
      password,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      isVerified: true,
    },
  });

  // --- CUSTOMER ---
  await prisma.user.upsert({
    where: { email: 'customer@wask.io' },
    update: {},
    create: {
      firstName: 'Cliente',
      lastName: 'Demo',
      email: 'customer@wask.io',
      password,
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
      isVerified: true,
    },
  });

  // --- DELIVERY ---
  await prisma.user.upsert({
    where: { email: 'delivery@wask.io' },
    update: {},
    create: {
      firstName: 'Repartidor',
      lastName: 'Demo',
      email: 'delivery@wask.io',
      password,
      role: UserRole.DELIVERY,
      status: UserStatus.ACTIVE,
      isVerified: true,
    },
  });

  // --- BUSINESS APROBADO ---
  const approvedBusiness = await prisma.business.upsert({
    where: { businessIdentifier: 'RUC-DEMO-001' },
    update: {},
    create: {
      companyName: 'Licorería Demo Wask',
      businessIdentifier: 'RUC-DEMO-001',
      industry: 'Licorería/Bodega',
      address: 'Av. Larco 123, Miraflores, Lima',
      phone: '+51 1 234 5678',
      verificationStatus: VerificationStatus.VERIFIED,
    },
  });

  await prisma.user.upsert({
    where: { email: 'business@wask.io' },
    update: {},
    create: {
      firstName: 'Business',
      lastName: 'Aprobado',
      email: 'business@wask.io',
      password,
      role: UserRole.BUSINESS_OWNER,
      status: UserStatus.ACTIVE,
      isVerified: true,
      businessId: approvedBusiness.id,
    },
  });

  // --- BUSINESS PENDIENTE ---
  const pendingBusiness = await prisma.business.upsert({
    where: { businessIdentifier: 'RUC-PENDING-001' },
    update: {},
    create: {
      companyName: 'Bodega Pendiente Wask',
      businessIdentifier: 'RUC-PENDING-001',
      industry: 'Licorería/Bodega',
      address: 'Jr. Huallaga 456, Lima',
      verificationStatus: VerificationStatus.PENDING,
    },
  });

  await prisma.user.upsert({
    where: { email: 'pending-business@wask.io' },
    update: {},
    create: {
      firstName: 'Business',
      lastName: 'Pendiente',
      email: 'pending-business@wask.io',
      password,
      role: UserRole.BUSINESS_OWNER,
      status: UserStatus.PENDING,
      isVerified: false,
      businessId: pendingBusiness.id,
    },
  });

  // --- ALMACÉN DEMO ---
  const warehouse = await prisma.warehouse.upsert({
    where: { businessId_code: { businessId: approvedBusiness.id, code: 'ALM-001' } },
    update: {},
    create: {
      businessId: approvedBusiness.id,
      name: 'Almacén Central Demo',
      code: 'ALM-001',
      address: 'Av. Larco 123, Miraflores, Lima',
      region: 'Lima',
    },
  });

  // --- PRODUCTOS DEMO ---
  const products = [
    {
      sku: 'PILSEN-630',
      name: 'Cerveza Pilsen 630ml',
      category: 'Cerveza',
      price: 5.5,
      brand: 'Pilsen Callao',
      volumeMl: 630,
      alcoholPercentage: 5.0,
      approvalStatus: ProductApprovalStatus.APPROVED,
      status: ProductStatus.ACTIVE,
    },
    {
      sku: 'CRISTAL-1L',
      name: 'Cerveza Cristal 1L',
      category: 'Cerveza',
      price: 8.5,
      brand: 'Cristal',
      volumeMl: 1000,
      alcoholPercentage: 5.0,
      approvalStatus: ProductApprovalStatus.APPROVED,
      status: ProductStatus.ACTIVE,
    },
    {
      sku: 'PISCO-QUE-750',
      name: 'Pisco Quebranta 750ml',
      category: 'Pisco',
      price: 45.0,
      brand: 'Tabernero',
      volumeMl: 750,
      alcoholPercentage: 42.0,
      approvalStatus: ProductApprovalStatus.APPROVED,
      status: ProductStatus.ACTIVE,
    },
    {
      sku: 'VINO-TINTO-750',
      name: 'Vino Tinto 750ml',
      category: 'Vino',
      price: 35.0,
      brand: 'Santiago Queirolo',
      volumeMl: 750,
      alcoholPercentage: 13.0,
      approvalStatus: ProductApprovalStatus.PENDING,
      status: ProductStatus.DRAFT,
    },
    {
      sku: 'WHISKY-750',
      name: 'Whisky 750ml',
      category: 'Whisky',
      price: 120.0,
      brand: 'Johnnie Walker Red',
      volumeMl: 750,
      alcoholPercentage: 40.0,
      approvalStatus: ProductApprovalStatus.PENDING,
      status: ProductStatus.DRAFT,
    },
  ];

  const now = new Date();
  for (const p of products) {
    const existing = await prisma.product.findFirst({
      where: { businessId: approvedBusiness.id, sku: p.sku },
    });
    if (existing) continue;

    const product = await prisma.product.create({
      data: {
        businessId: approvedBusiness.id,
        sku: p.sku,
        name: p.name,
        category: p.category,
        price: p.price,
        brand: p.brand,
        volumeMl: p.volumeMl,
        alcoholPercentage: p.alcoholPercentage,
        approvalStatus: p.approvalStatus,
        status: p.status,
        currency: 'PEN',
        approvedAt: p.approvalStatus === ProductApprovalStatus.APPROVED ? now : null,
        searchVector: [p.sku, p.name, p.category, p.brand].filter(Boolean).join(' '),
      },
    });

    if (p.approvalStatus === ProductApprovalStatus.APPROVED) {
      await prisma.inventoryItem.upsert({
        where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
        update: {},
        create: {
          productId: product.id,
          warehouseId: warehouse.id,
          availableStock: 100,
          minimumStock: 10,
        },
      });
    }
  }

  console.log('✓ Seed completado exitosamente');
  console.log('Usuarios demo:');
  console.log('  admin@wask.io       / ChangeMe123! (ADMIN)');
  console.log('  customer@wask.io    / ChangeMe123! (CUSTOMER)');
  console.log('  business@wask.io    / ChangeMe123! (BUSINESS_OWNER - APROBADO)');
  console.log('  pending-business@wask.io / ChangeMe123! (BUSINESS_OWNER - PENDIENTE)');
  console.log('  delivery@wask.io    / ChangeMe123! (DELIVERY)');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

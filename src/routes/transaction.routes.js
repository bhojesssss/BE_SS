import { Router } from 'express'
import { getUserClient, supabaseAdmin } from '../config/supabase.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// POST /transactions/checkout
router.post('/checkout', requireAuth, async (req, res) => {
  const { items, address_id, payment_method, notes } = req.body
  // items: [{ product_id, size, condition, qty }]

  if (!items?.length || !address_id || !payment_method) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'items, address_id, payment_method required' }
    })
  }

  // Validate address ownership
  const { data: address } = await supabaseAdmin
    .from('addresses')
    .select('id')
    .eq('id', address_id)
    .eq('user_id', req.user.id)
    .single()

  if (!address) {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Invalid address' }
    })
  }

  // Fetch product details (price, seller_id, name, image)
  const productIds = items.map(i => i.product_id)
  const { data: products, error: prodError } = await supabaseAdmin
    .from('products')
    .select('id, name, price, seller_id, images, is_available')
    .in('id', productIds)

  if (prodError || !products?.length) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Products not found' }
    })
  }

  // Check availability
  const unavailable = products.find(p => !p.is_available)
  if (unavailable) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: `Product "${unavailable.name}" no longer available` }
    })
  }

  // Calculate subtotal
  let subtotal = 0
  const ordersToCreate = items.map(item => {
    const product = products.find(p => p.id === item.product_id)
    if (!product) throw new Error('Product not found')
    const itemTotal = product.price * item.qty
    subtotal += itemTotal

    return {
      buyer_id: req.user.id,
      seller_id: product.seller_id,
      product_id: product.id,
      product_name: product.name,
      product_image: product.images?.[0] || null,
      price: product.price,
      size: item.size,
      condition: item.condition,
      qty: item.qty,
      total: itemTotal
    }
  })

  const service_fee = Math.round(subtotal * 0.01)
  const total = subtotal + service_fee

  // Create transaction (use admin client biar bisa generate id otomatis)
  const { data: transaction, error: txError } = await supabaseAdmin
    .from('transactions')
    .insert({
      buyer_id: req.user.id,
      address_id,
      payment_method,
      notes,
      subtotal,
      service_fee,
      total
    })
    .select()
    .single()

  if (txError) {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: txError.message }
    })
  }

  // Create orders (link to transaction)
  const ordersWithTx = ordersToCreate.map(o => ({ ...o, transaction_id: transaction.id }))
  const { data: createdOrders, error: orderError } = await supabaseAdmin
    .from('orders')
    .insert(ordersWithTx)
    .select()

  if (orderError) {
    // Rollback transaction kalo orders gagal dibuat
    await supabaseAdmin.from('transactions').delete().eq('id', transaction.id)
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: orderError.message }
    })
  }

  // Clear cart items yang udah di-checkout
  const supabase = getUserClient(req.token)
  await supabase
    .from('cart_items')
    .delete()
    .eq('user_id', req.user.id)
    .in('product_id', productIds)

  res.json({
    success: true,
    data: {
      transaction,
      orders: createdOrders
    }
  })
})

// GET /transactions/:id
router.get('/:id', requireAuth, async (req, res) => {
  const supabase = getUserClient(req.token)

  const { data: transaction, error } = await supabase
    .from('transactions')
    .select('*, addresses(*)')
    .eq('id', req.params.id)
    .single()

  if (error) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Transaction not found' }
    })
  }

  // Get orders in this transaction
  const { data: orders } = await supabase
    .from('orders')
    .select('*, profiles!seller_id(name, rating)')
    .eq('transaction_id', req.params.id)

  res.json({
    success: true,
    data: { ...transaction, orders }
  })
})

// POST /transactions/:id/pay
router.post('/:id/pay', requireAuth, async (req, res) => {
  const { payment_proof_url } = req.body

  const supabase = getUserClient(req.token)

  const { data, error } = await supabase
    .from('transactions')
    .update({
      payment_status: 'paid',
      payment_proof_url,
      paid_at: new Date().toISOString()
    })
    .eq('id', req.params.id)
    .select()
    .single()

  if (error) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: error.message }
    })
  }

  // Create notifications buat seller
  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('seller_id, product_name')
    .eq('transaction_id', req.params.id)

  if (orders?.length) {
    const notifications = orders.map(o => ({
      user_id: o.seller_id,
      type: 'order',
      title: 'Pesanan Baru!',
      message: `Pembeli telah membayar untuk "${o.product_name}". Silakan kirim barang.`
    }))
    await supabaseAdmin.from('notifications').insert(notifications)
  }

  res.json({ success: true, data })
})

// POST /transactions/:id/cancel
router.post('/:id/cancel', requireAuth, async (req, res) => {
  const supabase = getUserClient(req.token)

  const { data, error } = await supabase
    .from('transactions')
    .update({ payment_status: 'cancelled' })
    .eq('id', req.params.id)
    .select()
    .single()

  if (error) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: error.message }
    })
  }

  // Update related orders
  await supabaseAdmin
    .from('orders')
    .update({ status: 'Dibatalkan' })
    .eq('transaction_id', req.params.id)

  res.json({ success: true, data })
})

export default router
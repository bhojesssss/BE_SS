import { Router } from 'express'
import { getUserClient, supabaseAdmin } from '../config/supabase.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// BUG-004 FIX: /sales and /sales/:id/ship MUST be declared BEFORE /:id routes
// Otherwise Express treats "sales" as an :id param and runs the wrong handler

// GET /orders/sales?status=Diproses (seller orders)
router.get('/sales', requireAuth, async (req, res) => {
  try {
    const { status } = req.query
    const supabase = getUserClient(req.token)

    let query = supabase
      .from('orders')
      .select('*, buyer:profiles!buyer_id(name)')
      .eq('seller_id', req.user.id)
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)

    const { data, error } = await query

    if (error) {
      return res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: error.message }
      })
    }

    res.json({ success: true, data })
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } })
  }
})

// PATCH /orders/sales/:id/ship (seller input resi)
router.patch('/sales/:id/ship', requireAuth, async (req, res) => {
  try {
    const { tracking_number } = req.body

    if (!tracking_number) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'tracking_number required' }
      })
    }

    const supabase = getUserClient(req.token)

    const { data: order } = await supabase
      .from('orders')
      .select('status, seller_id, buyer_id, product_name')
      .eq('id', req.params.id)
      .single()

    if (!order || order.seller_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not your order' }
      })
    }

    const { data, error } = await supabase
      .from('orders')
      .update({
        status: 'Dikirim',
        tracking_number,
        shipped_at: new Date().toISOString()
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

    await supabaseAdmin.from('notifications').insert({
      user_id: order.buyer_id,
      type: 'order',
      title: 'Pesanan Dikirim',
      message: `"${order.product_name}" telah dikirim. No. resi: ${tracking_number}`
    })

    res.json({ success: true, data })
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } })
  }
})

// GET /orders?status=Dikirim (buyer history)
router.get('/', requireAuth, async (req, res) => {
  try {
    const { status } = req.query
    const supabase = getUserClient(req.token)

    let query = supabase
      .from('orders')
      .select('*, seller:profiles!seller_id(name)')
      .eq('buyer_id', req.user.id)
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)

    const { data, error } = await query

    if (error) {
      return res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: error.message }
      })
    }

    res.json({ success: true, data })
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } })
  }
})

// GET /orders/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        seller:profiles!seller_id(name, rating, city),
        buyer:profiles!buyer_id(name)
      `)
      .eq('id', req.params.id)
      .single()

    if (error) {
      console.log('ORDER DETAIL ERROR:', error)
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Order not found', detail: error.message }
      })
    }

    // Cek user yg login adalah buyer atau seller dari order ini
    if (data.buyer_id !== req.user.id && data.seller_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not your order' }
      })
    }

    res.json({ success: true, data })
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } })
  }
})

// PATCH /orders/:id/cancel (buyer)
router.patch('/:id/cancel', requireAuth, async (req, res) => {
  try {
    const supabase = getUserClient(req.token)

    const { data: order } = await supabase
      .from('orders')
      .select('status, buyer_id')
      .eq('id', req.params.id)
      .single()

    if (!order || order.buyer_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not your order' }
      })
    }

    if (order.status !== 'Diproses') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Can only cancel orders in Diproses status' }
      })
    }

    const { data, error } = await supabase
      .from('orders')
      .update({ status: 'Dibatalkan' })
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.message }
      })
    }

    res.json({ success: true, data })
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } })
  }
})

// PATCH /orders/:id/complete (buyer mark received)
router.patch('/:id/complete', requireAuth, async (req, res) => {
  try {
    const supabase = getUserClient(req.token)

    const { data: order } = await supabase
      .from('orders')
      .select('status, buyer_id, seller_id')
      .eq('id', req.params.id)
      .single()

    if (!order || order.buyer_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not your order' }
      })
    }

    if (order.status !== 'Dikirim') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Order must be in Dikirim status' }
      })
    }

    const { data, error } = await supabase
      .from('orders')
      .update({
        status: 'Selesai',
        completed_at: new Date().toISOString()
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

    // Manual increment total_sold (skip RPC biar ga error)
    const { data: seller } = await supabaseAdmin.from('profiles').select('total_sold').eq('id', order.seller_id).single()
    await supabaseAdmin.from('profiles').update({ total_sold: (seller?.total_sold || 0) + 1 }).eq('id', order.seller_id)

    res.json({ success: true, data })
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } })
  }
})

export default router
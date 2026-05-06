import { Router } from 'express'
import { getUserClient } from '../config/supabase.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// GET /cart
router.get('/', requireAuth, async (req, res) => {
  const supabase = getUserClient(req.token)
  const { data, error } = await supabase
    .from('cart_items')
    .select('*, products(id, name, price, images, seller_id, profiles!seller_id(name))')
    .order('created_at', { ascending: false })

  if (error) {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    })
  }

  res.json({ success: true, data })
})

// POST /cart
router.post('/', requireAuth, async (req, res) => {
  const { product_id, size, condition, qty } = req.body

  if (!product_id || !size || !condition) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'product_id, size, condition required' }
    })
  }

  const supabase = getUserClient(req.token)

  const { data, error } = await supabase
    .from('cart_items')
    .insert({
      user_id: req.user.id,
      product_id,
      size,
      condition,
      qty: qty || 1
    })
    .select('*, products(id, name, price, images)')
    .single()

  if (error) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: error.message }
    })
  }

  res.json({ success: true, data })
})

// PATCH /cart/:itemId
router.patch('/:itemId', requireAuth, async (req, res) => {
  const { qty } = req.body

  if (qty < 1) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'qty must be at least 1' }
    })
  }

  const supabase = getUserClient(req.token)
  const { data, error } = await supabase
    .from('cart_items')
    .update({ qty })
    .eq('id', req.params.itemId)
    .select()
    .single()

  if (error) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: error.message }
    })
  }

  res.json({ success: true, data })
})

// DELETE /cart/:itemId
router.delete('/:itemId', requireAuth, async (req, res) => {
  const supabase = getUserClient(req.token)
  const { error } = await supabase.from('cart_items').delete().eq('id', req.params.itemId)

  if (error) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: error.message }
    })
  }

  res.json({ success: true, data: { message: 'Item removed' } })
})

// DELETE /cart (clear all)
router.delete('/', requireAuth, async (req, res) => {
  const supabase = getUserClient(req.token)
  const { error } = await supabase.from('cart_items').delete().eq('user_id', req.user.id)

  if (error) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: error.message }
    })
  }

  res.json({ success: true, data: { message: 'Cart cleared' } })
})

export default router
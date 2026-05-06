import { Router } from 'express'
import { getUserClient, supabaseAdmin } from '../config/supabase.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// GET /addresses
router.get('/', requireAuth, async (req, res) => {
  const supabase = getUserClient(req.token)
  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    })
  }

  res.json({ success: true, data })
})

// POST /addresses
router.post('/', requireAuth, async (req, res) => {
  const { label, recipient, phone, full_address, is_default } = req.body

  if (!label || !recipient || !phone || !full_address) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' }
    })
  }

  const supabase = getUserClient(req.token)

  // Kalo set as default, unset default sebelumnya
  if (is_default) {
    await supabase.from('addresses').update({ is_default: false }).eq('user_id', req.user.id)
  }

  const { data, error } = await supabase
    .from('addresses')
    .insert({
      user_id: req.user.id,
      label,
      recipient,
      phone,
      full_address,
      is_default: is_default || false
    })
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

// PATCH /addresses/:id
router.patch('/:id', requireAuth, async (req, res) => {
  const supabase = getUserClient(req.token)
  const { data, error } = await supabase
    .from('addresses')
    .update(req.body)
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
})

// DELETE /addresses/:id
router.delete('/:id', requireAuth, async (req, res) => {
  const supabase = getUserClient(req.token)
  const { error } = await supabase.from('addresses').delete().eq('id', req.params.id)

  if (error) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: error.message }
    })
  }

  res.json({ success: true, data: { message: 'Deleted' } })
})

// PATCH /addresses/:id/default
router.patch('/:id/default', requireAuth, async (req, res) => {
  const supabase = getUserClient(req.token)

  // Unset all defaults first
  await supabase.from('addresses').update({ is_default: false }).eq('user_id', req.user.id)

  // Set this one as default
  const { data, error } = await supabase
    .from('addresses')
    .update({ is_default: true })
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
})

export default router
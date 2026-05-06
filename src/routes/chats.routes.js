import { Router } from 'express'
import { getUserClient, supabaseAdmin } from '../config/supabase.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// GET /chats
router.get('/', requireAuth, async (req, res) => {
  const supabase = getUserClient(req.token)
  const userId = req.user.id

  const { data, error } = await supabase
    .from('chats')
    .select(`
      *,
      buyer:profiles!buyer_id(id, name, avatar_url),
      seller:profiles!seller_id(id, name, avatar_url),
      products(id, name, price, images)
    `)
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order('last_message_at', { ascending: false })

  if (error) {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    })
  }

  // Add helper field: who's the "other" party from current user's POV
  const chats = data.map(chat => ({
    ...chat,
    is_buyer: chat.buyer_id === userId,
    other_user: chat.buyer_id === userId ? chat.seller : chat.buyer,
    unread: chat.buyer_id === userId ? chat.buyer_unread : chat.seller_unread
  }))

  res.json({ success: true, data: chats })
})

// POST /chats — start new chat
router.post('/', requireAuth, async (req, res) => {
  const { seller_id, product_id } = req.body

  if (!seller_id) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'seller_id required' }
    })
  }

  if (seller_id === req.user.id) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Cannot chat with yourself' }
    })
  }

  const supabase = getUserClient(req.token)

  // Cek kalo chat udah ada (unique constraint buyer+seller+product)
  const { data: existing } = await supabase
    .from('chats')
    .select('*')
    .eq('buyer_id', req.user.id)
    .eq('seller_id', seller_id)
    .eq('product_id', product_id || null)
    .maybeSingle()

  if (existing) {
    return res.json({ success: true, data: existing })
  }

  const { data, error } = await supabase
    .from('chats')
    .insert({
      buyer_id: req.user.id,
      seller_id,
      product_id: product_id || null
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

// GET /chats/:id
router.get('/:id', requireAuth, async (req, res) => {
  const supabase = getUserClient(req.token)
  const userId = req.user.id

  const { data, error } = await supabase
    .from('chats')
    .select(`
      *,
      buyer:profiles!buyer_id(id, name, avatar_url),
      seller:profiles!seller_id(id, name, avatar_url),
      products(id, name, price, images)
    `)
    .eq('id', req.params.id)
    .single()

  if (error) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Chat not found' }
    })
  }

  res.json({
    success: true,
    data: {
      ...data,
      is_buyer: data.buyer_id === userId,
      other_user: data.buyer_id === userId ? data.seller : data.buyer
    }
  })
})

// GET /chats/:id/messages
router.get('/:id/messages', requireAuth, async (req, res) => {
  const supabase = getUserClient(req.token)

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', req.params.id)
    .order('created_at', { ascending: true })

  if (error) {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    })
  }

  res.json({ success: true, data })
})

// POST /chats/:id/messages
router.post('/:id/messages', requireAuth, async (req, res) => {
  const { text } = req.body

  if (!text?.trim()) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Message text required' }
    })
  }

  const supabase = getUserClient(req.token)

  // Get chat info untuk update unread counter
  const { data: chat } = await supabaseAdmin
    .from('chats')
    .select('buyer_id, seller_id, buyer_unread, seller_unread')
    .eq('id', req.params.id)
    .single()

  if (!chat) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Chat not found' }
    })
  }

  // Insert message
  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      chat_id: req.params.id,
      sender_id: req.user.id,
      text: text.trim()
    })
    .select()
    .single()

  if (error) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: error.message }
    })
  }

  // Update chat: last_message, unread counter (yang nerima)
  const isFromBuyer = req.user.id === chat.buyer_id
  await supabaseAdmin
    .from('chats')
    .update({
      last_message: text.trim(),
      last_message_at: new Date().toISOString(),
      buyer_unread: isFromBuyer ? chat.buyer_unread : (chat.buyer_unread || 0) + 1,
      seller_unread: isFromBuyer ? (chat.seller_unread || 0) + 1 : chat.seller_unread
    })
    .eq('id', req.params.id)

  res.json({ success: true, data: message })
})

// PATCH /chats/:id/read
router.patch('/:id/read', requireAuth, async (req, res) => {
  const supabase = getUserClient(req.token)

  const { data: chat } = await supabaseAdmin
    .from('chats')
    .select('buyer_id, seller_id')
    .eq('id', req.params.id)
    .single()

  if (!chat) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Chat not found' }
    })
  }

  const isBuyer = req.user.id === chat.buyer_id
  const updateField = isBuyer ? { buyer_unread: 0 } : { seller_unread: 0 }

  const { data, error } = await supabase
    .from('chats')
    .update(updateField)
    .eq('id', req.params.id)
    .select()
    .single()

  if (error) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: error.message }
    })
  }

  // Mark all messages as read
  await supabaseAdmin
    .from('messages')
    .update({ is_read: true })
    .eq('chat_id', req.params.id)
    .neq('sender_id', req.user.id)

  res.json({ success: true, data })
})

export default router
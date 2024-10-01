import { z } from 'zod'

export const getAvatarSchema = z.object({
  size: z.number().int().min(1).max(2048).optional()
})

export const contactSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  message: z.string().min(1).max(2000)
})

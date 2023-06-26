import { Context } from "telegraf";
import prisma from "../common/prisma";

export const userMiddleware = async (ctx: Context, next: () => Promise<void>) => {
  let username = ctx.from.username
  if(username === undefined) {
    username = (ctx.from.first_name + " " + ctx.from.last_name?ctx.from.last_name:'').trim()
  } else {
    username = `@${username}`
  }
  await prisma.user.upsert({
    create: {
      telegramId: ctx.from.id.toString(),
      telegramName: username
    },
    update: {
      telegramName: username
    },
    where: {
      telegramId: ctx.from.id.toString(),
    }
  })
  
  return await next()
}
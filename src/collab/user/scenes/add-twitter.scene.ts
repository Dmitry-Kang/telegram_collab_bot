import { Scene, Ctx, SceneEnter, SceneLeave, Command, On, Hears } from "nestjs-telegraf";
import { ADD_TWITTER } from "../../../app.constants";
import { Markup } from "telegraf"
import { Context } from "../../../interfaces/context.interface";
import prisma from "../../../common/prisma";
import { UserService } from "../user.service";
import { UserController } from "../user.controller";

@Scene(ADD_TWITTER)
export class AddTwitterScene {

  toTwitterHandles(twitter: string) {
    const TWITTER_HANDLE_PATTERN = /^(?:.*?\btwitter\.com\/)?@?([a-zA-Z0-9_]{1,15})(?:[?\/,].*)?$/g
    if (!twitter) {
      return
    }
    const lower_twitter = twitter.trim().toLowerCase()
    const match = Array.from(lower_twitter.matchAll(TWITTER_HANDLE_PATTERN))
    if (match && match.length > 0) {
      return match[0][1]
    }
    return false
  }

  toTwitterHandle(twitters: string[], user): {name: string, authorId: number}[] {
    const setTwitters = new Set()
    twitters.forEach(element => {
      const handle = this.toTwitterHandles(element)
      if (handle) {
        setTwitters.add({name: handle, authorId: user.id})
      }
    });
    return Array.from(setTwitters) as {name: string, authorId: number}[]
  }

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Context) {
    await ctx.replyWithHTML(`${"Отправляйте твитеры в строчку одним или несколькими сообщениями в формате:\nhttps://twitter.com/elonmusk\nhttps://twitter.com/@elonmusk\nhttps://twitter.com/elonmusk?lang=en\nhttps://twitter.com/@elonmusk?lang=en\n@elonmusk\nelonmusk"}`, {reply_markup: {resize_keyboard:true, keyboard: [["Закончить добавление"]]}, disable_web_page_preview: true});
  }

  @Hears(["Закончить добавление"])
  async onSceneLeave(@Ctx() ctx: Context) {
    await UserController.goToMainMenu(ctx)
  }

  @On('message')
  async onMessage(@Ctx() ctx: Context) {
    const ok = await UserController.checkRoles(ctx, ['MANAGER', 'ADMIN'])
    if (!ok) {
      return
    }
    const user = await UserService.findById(ctx.from.id.toString())
    const twitterHandles = this.toTwitterHandle(ctx.message['text'].split("\n"), user)
    // let res = await prisma.$transaction( // TODO если захочется допилить чтобы показывал добавленные проекты, а не просто количество
    //     twitterHandles.map((twitter) => prisma.project.create({ data: twitter })),
    // );
    let res = await prisma.project.createMany({
      data: twitterHandles,
      skipDuplicates: true,
    })
    await ctx.replyWithHTML(`Добавлено ${res.count} новых проектов`);
  }

  
}

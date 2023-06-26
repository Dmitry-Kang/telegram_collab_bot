import { Command, Ctx, Hears, Start, Update, Sender, TelegrafContextType,Help, Scene, InjectBot, Use, Next} from "nestjs-telegraf";
import { UserService } from "./user.service";
import { Markup, Telegraf } from "telegraf";

import { Context } from "../../interfaces/context.interface";
import texts from "./texts/texts"
import { UserRoles } from "@prisma/client";
import { format } from "util";
import { ADD_TWITTER, GET_TOP , GET_NEW, GET_MY, GET_MANAGERS, FIND} from "../../app.constants";
import prisma from "../../common/prisma";
// import { Pagination }  from 'telegraf-pagination';


@Update()
export class UserController {

  static async checkRoles(ctx: Context, roles: string[]) {
    const user = await UserService.findById(ctx.from.id.toString())
    if (!roles.includes(user.role)) {
      const keyboard = await this.getMainSceneKeyboard(ctx)
      await ctx.replyWithHTML(`${"Вы в главном меню"}`, keyboard);
      await ctx.scene.leave();
      return false
    }
    return true
  }

  static async goToMainMenu(ctx: Context) {
    const keyboard = await this.getMainSceneKeyboard(ctx)
    await ctx.replyWithHTML(`${"Вы в главном меню"}`, keyboard);
    await ctx.scene.leave();
  }

  static async getMainSceneKeyboard(ctx: Context) {
    const user = await UserService.findById(ctx.from.id.toString())
    let arr:any = [['/help']]
    
    if (['ADMIN', 'MANAGER'].includes(user.role)) {
        arr.push(["/find", "/add", "/my", "/top", "/new"])
        if (user.role == 'ADMIN' ) {
            arr.push(["/managers", "/add_manager"], ["/remove_manager", "/remove_project"])
        }
    }
    let keyboard = Markup.keyboard(
      arr
    ).resize()
    return keyboard
  }

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
  
  @Hears(["Закончить просмотр", "Закончить добавление", "Закончить поиск"])
  async finish(@Ctx() ctx: Context): Promise<void> {
    await UserController.goToMainMenu(ctx)
  }
  @Command("add")
  async onSceneCommand(@Ctx() ctx: Context): Promise<void> {
    const user = await UserService.findById(ctx.from.id.toString())
    if (['ADMIN', 'MANAGER'].includes(user.role))
      await ctx.scene.enter(ADD_TWITTER);
  }
  @Command("my")
  async onMySceneCommand(@Ctx() ctx: Context): Promise<void> {
    const user = await UserService.findById(ctx.from.id.toString())
    if (['ADMIN', 'MANAGER'].includes(user.role))
      await ctx.scene.enter(GET_MY);
  }
  @Command("find")
  async onFindSceneCommand(@Ctx() ctx: Context): Promise<void> {
    const user = await UserService.findById(ctx.from.id.toString())
    if (['ADMIN', 'MANAGER'].includes(user.role))
      await ctx.scene.enter(FIND);
  }
  @Command("top")
  async onTopSceneCommand(@Ctx() ctx: Context): Promise<void> {
    const user = await UserService.findById(ctx.from.id.toString())
    if (['ADMIN', 'MANAGER'].includes(user.role))
      await ctx.scene.enter(GET_TOP);
  }
  @Command("new")
  async onNewSceneCommand(@Ctx() ctx: Context): Promise<void> {
    const user = await UserService.findById(ctx.from.id.toString())
    if (['ADMIN', 'MANAGER'].includes(user.role))
      await ctx.scene.enter(GET_NEW);
  }
  
  @Command("managers")
  async onManagersSceneCommand(@Ctx() ctx: Context): Promise<void> {
    const user = await UserService.findById(ctx.from.id.toString())
    if (['ADMIN'].includes(user.role))
      await ctx.scene.enter(GET_MANAGERS);
  }
  @Command("add_manager")
  async onAddManagerCommand(@Ctx() ctx: Context): Promise<void> {
    const user = await UserService.findById(ctx.from.id.toString())
    if (!['ADMIN'].includes(user.role)) {
      return
    }
    const text = ctx.message["text"]
    const args = text.trim().split(" ")
    try {
      const res = await prisma.user.update({
        data: {
          role: "MANAGER"
        },
        where: {
          telegramId: args[1]
        }
      })
      await ctx.replyWithHTML( `${res.telegramName} теперь менеджер` );
    } catch {
      await ctx.replyWithHTML( `пользователь не найден` );
    }
  }
  @Command("remove_manager")
  async onRemoveManagerCommand(@Ctx() ctx: Context): Promise<void> {
    const user = await UserService.findById(ctx.from.id.toString())
    if (!['ADMIN'].includes(user.role)) {
      return
    }
    const text = ctx.message["text"]
    const args = text.trim().split(" ")
    try {
      const res = await prisma.user.update({
        data: {
          role: "USER"
        },
        where: {
          telegramId: args[1]
        }
      })
      await prisma.project.updateMany({
        data: {
          leadId: null
        },
        where: {
          leadId: res.id
        }
      })
      await ctx.replyWithHTML( `${res.telegramName} теперь юзер (удален)` );
    } catch {
      await ctx.replyWithHTML( `пользователь не найден` );
    }
  }
  @Command("remove_project")
  async onRemoveProjectCommand(@Ctx() ctx: Context): Promise<void> {
    const user = await UserService.findById(ctx.from.id.toString())
    if (!['ADMIN'].includes(user.role)) {
      return
    }
    const text = ctx.message["text"]
    const args = text.trim().split(" ")
    const namee = this.toTwitterHandles(args[1]) as string;
    try {
      const res = await prisma.project.update({
        data: {
          tssScore: -1
        },
        where: {
          name: namee
        }
      })
      await ctx.replyWithHTML( `${res.name} теперь скрыт (удален)` );
    } catch {
      await ctx.replyWithHTML( `проект не найден` );
    }
  }

  @Start()
  async onStart(@Ctx() ctx: Context) {
    // await ctx.telegram.setMyCommands([
    //   {
    //     command: "/ali",
    //     description: "ali description",
    //   },
    //   ],); 
    // await ctx.telegram.deleteMyCommands({scope:"all_private_chats"})
    const user = await UserService.findById(ctx.from.id.toString())
    console.log("user",user)
    const admins = await UserService.getAdmins()
    let adminsNames = ""
    if (admins.length > 0) {
      admins.forEach(element => {
        adminsNames += `${element.telegramName}\n`
      });
    } else {
      adminsNames = texts["start_no-admin"]
    }
    const keyboard = await UserController.getMainSceneKeyboard(ctx)
    switch (user.role) {
      case UserRoles.USER: {
        await ctx.replyWithHTML( format(texts.start_user, ctx.from.id.toString(), adminsNames), keyboard );
        break
      }
      case UserRoles.MANAGER: {
        await ctx.replyWithHTML( texts.start_manager, keyboard );
        break
      }
      case UserRoles.ADMIN: {
        await ctx.replyWithHTML( texts.start_admin, keyboard );
        break
      }
    }
  }
  
  @Help()
  async onHelp(@Ctx() ctx: Context) {
      const user = await UserService.findById(ctx.from.id.toString())
      const keyboard = await UserController.getMainSceneKeyboard(ctx)
      let res = `${texts.help}`
      const test: UserRoles[] = [UserRoles.ADMIN, UserRoles.MANAGER];
      if (['ADMIN', 'MANAGER'].includes(user.role)) {
          res += `\n${texts.help_manager}`
          if (user.role == UserRoles.ADMIN ) {
              res += `\n${texts.help_admin}`
          }
          
      }
      await ctx.replyWithHTML(`${res}`, keyboard);
  }
}
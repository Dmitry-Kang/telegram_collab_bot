import { Scene, Ctx, SceneEnter, SceneLeave, Command, Action, Hears } from "nestjs-telegraf";
import { GET_MANAGERS } from "../../../app.constants";
import { Context } from "../../../interfaces/context.interface";
import { Pagination as TelegrafPagination } from 'telegraf-pagination';
import prisma from "../../../common/prisma";
import { UserService } from "../user.service";
import { Markup } from "telegraf";
import { UserController } from "../user.controller";

@Scene(GET_MANAGERS)
export class GetManagersScene {
  private pagination: TelegrafPagination
  constructor() {}


  async getItems(ctx) {
    const user_db = await UserService.findById(ctx.from.id.toString())
    let users = await prisma.user.findMany({
      where: {
        OR: [
          {
            role: "MANAGER"
          },
          {
            role: "ADMIN"
          }
        ]
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        projects: true,
        leadingProjects: true
      }
    })
    
    users = users.map(user => {
      const createdProjects = user.projects.length
      const totalLead = user.leadingProjects.length
      return {
        ...user,
        totalLead,
        createdProjects
      }
    })

    const res = users.map((proj, i) => {
      let scene_id = i
      let scene_tg_name = proj.telegramName
      let scene_tg_id = proj.telegramId
      return {
        ...proj,
        scene_id,
        scene_tg_name,
        scene_tg_id
      }
    })

    return res
  }

  async selectProject(ctx, item, index) {
    const user = await UserService.findById(ctx.from.id.toString())
    const project = await prisma.project.findUnique({
      where: {
        name: item.scene_title
      }
    })

    const data_leave = { user:user.id, project: project.id, name: 'action_leave_project' };
    const data_like = { user:user.id, project: project.id, name: 'action_like' };
    const data_dislike = { user:user.id, project: project.id, name: 'action_dislike' };

    await ctx.replyWithHTML(`Вы выбрали https://twitter.com/${item.scene_title}`, {
      reply_markup: {
        inline_keyboard: [
            [ 
              { text: "Выйти из проекта", callback_data: JSON.stringify(data_leave) },  
            ],
            [ 
              { text: "Лайк", callback_data: JSON.stringify(data_like) },
              { text: "Дизлайк", callback_data: JSON.stringify(data_dislike) }
             ]
        ]
      },
      disable_web_page_preview: true
    });
  }

  @Action(/action_leave_project.*/)
  async onProjectLeave(@Ctx() ctx: Context) {
    const ok = await UserController.checkRoles(ctx, ['ADMIN'])
    if (!ok) {
      return
    }
    const callbackData = JSON.parse(ctx.callbackQuery.data);
    const item = await prisma.project.update({
      data: {
        leadId: null
      },
      where: {
        id: callbackData.project
      }
    }) 
    await ctx.replyWithHTML(`Вы сняли роль лида на проект https://twitter.com/${item.name}`, {disable_web_page_preview: true});
  }

  @Action(/action_like.*/)
  async onProjectLike(@Ctx() ctx: Context) {
    const ok = await UserController.checkRoles(ctx, ['ADMIN'])
    if (!ok) {
      return
    }
    const callbackData = JSON.parse(ctx.callbackQuery.data);
    const project = await prisma.project.findUnique({where: {id: callbackData.project}})
    const item = await prisma.vote.findFirst({
      where: {
        projectId: callbackData.project,
        userId: callbackData.user
      }
    });
    if (!item) {
      await prisma.vote.create({
        data: {
          vote: true,
          projectId: callbackData.project,
          userId: callbackData.user
        }
      });
    } else {
      await prisma.vote.update({
        data: {
          vote: true
        },
        where: {
          id: item.id
        }
      });
    }
    await ctx.replyWithHTML(`Вы поставили лайк на проект https://twitter.com/${project.name}`, {disable_web_page_preview: true});
  }

  @Action(/action_dislike.*/)
  async onProjectDislike(@Ctx() ctx: Context) {
    const ok = await UserController.checkRoles(ctx, ['ADMIN'])
    if (!ok) {
      return
    }
    const callbackData = JSON.parse(ctx.callbackQuery.data);
    const project = await prisma.project.findUnique({where: {id: callbackData.project}})
    const item = await prisma.vote.findFirst({
      where: {
        projectId: callbackData.project,
        userId: callbackData.user
      }
    });
    if (!item) {
      await prisma.vote.create({
        data: {
          vote: false,
          projectId: callbackData.project,
          userId: callbackData.user
        }
      });
    } else {
      await prisma.vote.update({
        data: {
          vote: false
        },
        where: {
          id: item.id
        }
      });
    }
    await ctx.replyWithHTML(`Вы поставили дизлайк на проект https://twitter.com/${project.name}`, {disable_web_page_preview: true});
  }

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Context) {
    const projects = await this.getItems(ctx)
    if (projects.length > 0) {this.pagination = new TelegrafPagination({
      isEnabledDeleteButton: false,
      data: projects,
      inlineCustomButtons: [[
        Markup.button.callback('Окончить просмотр', 'action_leave')
      ]],
      header: (currentPage, pageSize, total) =>
      `${currentPage} страница из ${Math.ceil(total/pageSize)}`,
      onSelect: async (item, index) => {
      },
      messages: {
        firstPage: "❗️Это первая страница",
        lastPage: "❗️ Это последняя страница",
        prev: "◀️",
        next: "▶️",
        delete: "✅",
      },
      format: (item, index) => `${item.scene_id + 1}. [${item.role}] ${item.scene_tg_name} (${item.scene_tg_id})`,
      pageSize: 10,
      rowSize: 5,
    });
    let message = await this.pagination.text();
    let keyboard = await this.pagination.keyboard();

    await this.pagination.handleActions(ctx.scene.current);
    const keyboard2 = Markup.keyboard(
      ['Закончить просмотр']
    ).resize()
    await ctx.telegram.sendMessage(ctx.from.id, "Список менеджеров", keyboard2)
    await ctx.replyWithHTML(message, {
      reply_markup: keyboard.reply_markup,
      disable_web_page_preview: true
    });}
    else {
      await ctx.replyWithHTML("Менеджеров в системе не найдено")
    }
  }

  @Hears(["Закончить просмотр"])
  @Action("action_leave")
  async onSceneLeave(@Ctx() ctx: Context) {
    try {
      await ctx.deleteMessage(ctx.callbackQuery.message.message_id)
    } catch {}
    
    await UserController.goToMainMenu(ctx)
  }
}

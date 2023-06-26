import { Scene, Ctx, SceneEnter, Action, Hears, On } from "nestjs-telegraf";
import { FIND } from "../../../app.constants";
import { Context } from "../../../interfaces/context.interface";
import { Pagination as TelegrafPagination } from 'telegraf-pagination';
import prisma from "../../../common/prisma";
import { UserService } from "../user.service";
import { Markup } from "telegraf";
import { UserController } from "../user.controller";

@Scene(FIND)
export class FindScene {
  private pagination: TelegrafPagination
  constructor() {}

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

  async getItems(ctx, text) {
    const user = await UserService.findById(ctx.from.id.toString())
    const projects = await prisma.project.findMany({
      where: {
        name: {
          contains: text
        },
        OR: [
          {
            authorId: {
              equals: user.id
            }
          },
          {
            createdAt: {
              lte: new Date(Date.now() - 5 * 60 * 1000)
            }
          }
        ],
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        votes: true,
        lead: true
      },
      take: 300
    })
    
    const projectsWithTotalVote = projects.map(project => {
      const totalVote = project.votes.reduce((sum, vote) => {
        return sum + (vote.vote ? 1 : -1)
      }, 0)
      const likes = project.votes.reduce((sum, vote) => {
        return sum + (vote.vote ? 1 : 0)
      }, 0)
      const dislikes = project.votes.reduce((sum, vote) => {
        return sum + (vote.vote ? 0 : 1)
      }, 0)
      return {
        ...project,
        totalVote,
        likes,
        dislikes
      }
    })

    const res = projectsWithTotalVote.map((proj, i) => {
      let scene_id = i
      let scene_title = proj.name
      let is_author = false
      if (proj.authorId === user.id) {
        is_author = true
      }
      return {
        ...proj,
        scene_id,
        scene_title,
        is_author
      }
    })

    return res
  }

  async selectProject(ctx, item, index) {
    const ok = await UserController.checkRoles(ctx, ['MANAGER', 'ADMIN'])
    if (!ok) {
      return
    }
    const user = await UserService.findById(ctx.from.id.toString())
    const project = await prisma.project.findUnique({
      where: {
        name: item.scene_title
      }
    })

    const data_take_untake = { user:user.id, project: project.id, name: 'action_take_untake' };
    const data_like = { user:user.id, project: project.id, name: 'action_like' };
    const data_dislike = { user:user.id, project: project.id, name: 'action_dislike' };

    await ctx.replyWithHTML(`Вы выбрали https://twitter.com/${item.scene_title}${project.notes?`\n\nЗаметки:\n${project.notes['text']}`:''}`, {
      reply_markup: {
        inline_keyboard: [
            [ 
              { text: `${project.leadId == user.id?`Выйти из проекта`:`Взять проект`}`, callback_data: JSON.stringify(data_take_untake) },  
              { text: `Лайк`, callback_data: JSON.stringify(data_like) },
              { text: `Дизлайк`, callback_data: JSON.stringify(data_dislike) },
            ]
        ]
      },
      disable_web_page_preview: true
    });
  }

  @Action(/action_like.*/)
  async onProjectLike(@Ctx() ctx: Context) {
    const ok = await UserController.checkRoles(ctx, ['MANAGER', 'ADMIN'])
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
    if (item && item.voteData > new Date(Date.now() - 2 * 60 * 1000)) {
      await ctx.answerCbQuery(`Подождите 2 минуты чтобы поставить лайк`);
      return
    }
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
          vote: true,
          voteData: new Date()
        },
        where: {
          id: item.id
        }
      });
    }
    await ctx.answerCbQuery(`Вы поставили лайк на проект https://twitter.com/${project.name}`);
  }

  @Action(/action_dislike.*/)
  async onProjectDislike(@Ctx() ctx: Context) {
    const ok = await UserController.checkRoles(ctx, ['MANAGER', 'ADMIN'])
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
    if (item && item.voteData > new Date(Date.now() - 2 * 60 * 1000)) {
      await ctx.answerCbQuery(`Подождите 2 минуты чтобы поставить дизлайк`);
      return
    }
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
          vote: false,
          voteData: new Date()
        },
        where: {
          id: item.id
        }
      });
    }
    await ctx.answerCbQuery(`Вы поставили дизлайк на проект https://twitter.com/${project.name}`);
  }

  @Action(/action_take_untake.*/)
  async onChangeNotes(@Ctx() ctx: Context) {
    const ok = await UserController.checkRoles(ctx, ['MANAGER', 'ADMIN'])
    if (!ok) {
      return
    }
    const callbackData = JSON.parse(ctx.callbackQuery.data);

    const user = await UserService.findById(ctx.from.id.toString())
    const project = await prisma.project.findUnique({
      where: {
        id: callbackData.project
      }
    })

    if (!project.leadId) {
      project.leadId = user.id
      await prisma.project.update({
        data: {
          leadId: user.id
        },
        where: {
          name: project.name
        }
      }) 
      await prisma.leadHistory.create({
        data: {
          userId: user.id,
          projectId: project.id
        }
      })
      ctx.replyWithHTML(`Вы взяли роль лида на проект https://twitter.com/${project.name}`, {disable_web_page_preview: true});
    } else {
      if (project.leadId === user.id) {
        project.leadId = null
        await prisma.project.update({
          data: {
            leadId: null
          },
          where: {
            name: project.name
          }
        }) 
        ctx.replyWithHTML(`Вы сняли роль лида на проект https://twitter.com/${project.name}`, {disable_web_page_preview: true});
      } else {
        ctx.replyWithHTML(`Проект https://twitter.com/${project.name} уже ктото занял`, {disable_web_page_preview: true});
        return
      }
    }

    const data_take_untake = { user:user.id, project: project.id, name: 'action_take_untake' };
    const data_like = { user:user.id, project: project.id, name: 'action_like' };
    const data_dislike = { user:user.id, project: project.id, name: 'action_dislike' };
    await ctx.editMessageText(`Вы выбрали https://twitter.com/${project.name}${project.notes?`\n\nЗаметки:\n${project.notes['text']}`:''}`, {
      reply_markup: {
        inline_keyboard: [
            [ 
              { text: `${project.leadId == user.id?`Выйти из проекта`:`Взять проект`}`, callback_data: JSON.stringify(data_take_untake) },  
              { text: `Лайк`, callback_data: JSON.stringify(data_like) },
              { text: `Дизлайк`, callback_data: JSON.stringify(data_dislike) },
            ]
        ]
      },
      disable_web_page_preview: true
    });
  }

  @Hears(["Закончить поиск"])
  @Action("action_leave")
  async onSceneLeave(@Ctx() ctx: Context) {
    try {
      await ctx.deleteMessage(ctx.callbackQuery.message.message_id)
    } catch {}

    await UserController.goToMainMenu(ctx)
  }

  @On('message')
  async onMessage(@Ctx() ctx: Context) {
    // console.log(ctx.telegram.answerCbQuery())
    const text = this.toTwitterHandles(ctx.message["text"]) 
    if (!text) {
      await ctx.replyWithHTML(`Не удалось распознать текст.`);
      return
    }
    this.pagination = new TelegrafPagination({
      isEnabledDeleteButton: false,
      data: await this.getItems(ctx, text),
      inlineCustomButtons: [[
        Markup.button.callback('Закончить поиск', 'action_leave')
      ]],
      header: (currentPage, pageSize, total) =>
      `${currentPage} страница из ${Math.ceil(total/pageSize)}`,
      onSelect: async (item, index) => {
        await this.selectProject(ctx, item, index)
      },
      messages: {
        firstPage: "❗️Это первая страница",
        lastPage: "❗️ Это последняя страница",
        prev: "◀️",
        next: "▶️",
        delete: "✅",
      },
      format: (item, index) => {
        if (item.likes === 0 && item.dislikes === 0) {
          return `${index + 1}. [NEW!]${item.tssScore > 0 ?` (${item.tssScore})`:``} <a href="https://twitter.com/${item.scene_title}">${item.scene_title}</a>${item.leadId?` Занят ${item.lead.telegramName}`:''}`
        }
        return `${index + 1}. [+${item.likes}/-${item.dislikes}]${item.tssScore > 0 ?` (${item.tssScore})`:``} <a href="https://twitter.com/${item.scene_title}">${item.scene_title}</a>${item.leadId?` Занят ${item.lead.telegramName}`:''}`
      },
      pageSize: 10,
      rowSize: 5,
    });
    let message = await this.pagination.text();
    let keyboard = await this.pagination.keyboard();

    await this.pagination.handleActions(ctx.scene.current);
    const keyboard2 = Markup.keyboard(
      ['Закончить поиск']
    ).resize()
    await ctx.telegram.sendMessage(ctx.from.id, "Выберите проект на который хотите взять лид", keyboard2)
    await ctx.replyWithHTML(message, {
      reply_markup: keyboard.reply_markup,
      disable_web_page_preview: true
    });
  }

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Context) {
    await ctx.replyWithHTML(`${"Отправляйте твитеры в строчку одним или несколькими сообщениями в формате:\nhttps://twitter.com/elonmusk\nhttps://twitter.com/@elonmusk\nhttps://twitter.com/elonmusk?lang=en\nhttps://twitter.com/@elonmusk?lang=en\n@elonmusk\nelonmusk"}`, {reply_markup: {resize_keyboard:true, keyboard: [["Закончить поиск"]]}, disable_web_page_preview: true});
  }
  
}

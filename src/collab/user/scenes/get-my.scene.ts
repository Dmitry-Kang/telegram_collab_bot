import { Scene, Ctx, SceneEnter, Action, Hears, On } from "nestjs-telegraf";
import { GET_MY } from "../../../app.constants";
import { Context } from "../../../interfaces/context.interface";
import { Pagination as TelegrafPagination } from 'telegraf-pagination';
import prisma from "../../../common/prisma";
import { UserService } from "../user.service";
import { Markup } from "telegraf";
import { UserController } from "../user.controller";
import axios from 'axios';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

@Scene(GET_MY)
export class GetMyScene {
  private pagination: TelegrafPagination
  constructor() {}


  async getItems(ctx) {
    const user = await UserService.findById(ctx.from.id.toString())
    const projects = await prisma.project.findMany({
      where: {
        leadId: {
          equals: user.id
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        votes: true
      }
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
    const user = await UserService.findById(ctx.from.id.toString())
    const project = await prisma.project.findUnique({
      where: {
        name: item.scene_title
      }
    })

    const data_leave = { user:user.id, project: project.id, name: 'action_leave_project' };
    const data_change = { user:user.id, project: project.id, name: 'action_change_notes' };
    const data_tss = { user:user.id, project: project.id, name: 'action_get_tss' };
    if (project.leadId != user.id) {
      await ctx.replyWithHTML(`Вы уже не занимаетесь проектом https://twitter.com/${item.scene_title}`, {disable_web_page_preview: true})
      return
    }

    await ctx.replyWithHTML(`Вы выбрали https://twitter.com/${item.scene_title}${project.notes?`\n\nЗаметки:\n${project.notes['text']}`:''}`, {
      reply_markup: {
        inline_keyboard: [
            [ 
              { text: "Выйти из проекта", callback_data: JSON.stringify(data_leave) },  
              { text: "Изменить заметку", callback_data: JSON.stringify(data_change) },
              { text: "Запросить tss", callback_data: JSON.stringify(data_tss) },
            ]
        ]
      },
      disable_web_page_preview: true
    });
  }

  @Action(/action_change_notes.*/)
  async onChangeNotes(@Ctx() ctx: Context) {
    const ok = await UserController.checkRoles(ctx, ['MANAGER', 'ADMIN'])
    if (!ok) {
      return
    }
    const callbackData = JSON.parse(ctx.callbackQuery.data);
    ctx.session['edit_note'] = {status: true, project_id: callbackData.project, chat_id: ctx.chat.id, message_id: ctx.callbackQuery.message.message_id, inline_message_id: ctx.inlineMessageId}
    await ctx.replyWithHTML(`Отправьте текст для заметок`)
  }

  @Action(/action_leave_project.*/)
  async onProjectLeave(@Ctx() ctx: Context) {
    const ok = await UserController.checkRoles(ctx, ['MANAGER', 'ADMIN'])
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
    const data_like = { user:callbackData.user, project: callbackData.project, name: 'action_like' };
    const data_dislike = { user:callbackData.user, project: callbackData.project, name: 'action_dislike' };
    // console.log(ctx)
    // await ctx.editMessageText(ctx.message["text"])
    await ctx.editMessageText(`Вы вышли из проекта https://twitter.com/${item.name}\nПоставьте вашу оценку проекту`, {
      reply_markup: {
        inline_keyboard: [
            [ 
              { text: "Лайк", callback_data: JSON.stringify(data_like) },
              { text: "Дизлайк", callback_data: JSON.stringify(data_dislike) }
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
    await ctx.editMessageText(`Вы вышли из проекта https://twitter.com/${project.name}`, {disable_web_page_preview: true})
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
    await ctx.editMessageText(`Вы вышли из проекта https://twitter.com/${project.name}`, {disable_web_page_preview: true})
    await ctx.answerCbQuery(`Вы поставили дизлайк на проект https://twitter.com/${project.name}`);
  }

  async getPostTitles(twitter) {
    let finish = false
    let tries = 0
    let res = '0'
    do {
      try {
        await delay(10 * 1000)
        const url = 'https://tweetscout.io/api/v1/accounts/search'
        await axios.get(
          url, {
            params: {
              q: twitter
            },
            headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Mobile Safari/537.36' }
          }
        ).then(function (response) {
          // console.log(response.data.score.value)
          if (response?.data?.score?.value) {
            res = response.data.score.value;
            finish = true
            console.log(`get my scene success ${twitter}: tss ${res}`)
          } else {
            tries++
            console.log(`get my scene err1 ${twitter}`, response.status)
          }
        }).catch(e => {
          if (e?.response?.data?.detail && e.response.data.detail == "Account not found") {
            res = "-3"
            finish = true
            console.log(`get my scene not found ${twitter}: tss ${res}`)
          } else {
            tries++
            console.log(`get my scene err2 ${twitter}`, e.response.status)
          }
        });
      } catch (error) {
        tries++
        console.log(`get my scene err3 ${twitter}`, error)
      }
    } while (!finish || tries > 10)
    return res
  }

  @Action(/action_get_tss.*/)
  async onGetTss(@Ctx() ctx: Context) {
    const ok = await UserController.checkRoles(ctx, ['MANAGER', 'ADMIN'])
    if (!ok) {
      return
    }
    const callbackData = JSON.parse(ctx.callbackQuery.data);
    const project = await prisma.project.findUnique({where: {id: callbackData.project}})
    if (project.tssRequestedAt > new Date(Date.now() - 2 * 60 * 1000)) {
      await ctx.answerCbQuery(`Подождите 2 минуты чтобы снова запросить tss`);
      return
    }
    if (!project.notes) {
      project.notes = undefined
    }
    project.tssScore = parseInt(await this.getPostTitles(project.name)) 
    project.tssRequestedAt = new Date() 
    await prisma.project.update({
      where: {
        id: project.id,
      },
      data: project
    });
    await ctx.answerCbQuery(`Успешно`);
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
          return `${index + 1}. [NEW!]${item.tssScore > 0 ?` (${item.tssScore})`:``} <a href="https://twitter.com/${item.scene_title}">${item.scene_title}</a>`
        }
        return `${index + 1}. [+${item.likes}/-${item.dislikes}]${item.tssScore > 0 ?` (${item.tssScore})`:``} <a href="https://twitter.com/${item.scene_title}">${item.scene_title}</a>`
      },
      pageSize: 10,
      rowSize: 5,
    });
    let message = await this.pagination.text();
    let keyboard = await this.pagination.keyboard();

    await this.pagination.handleActions(ctx.scene.current);
    const keyboard2 = Markup.keyboard(
      ['Закончить просмотр']
    ).resize()
    await ctx.telegram.sendMessage(ctx.from.id, "Проекты под вашим лидом", keyboard2)
    await ctx.replyWithHTML(message, {
      reply_markup: keyboard.reply_markup,
      disable_web_page_preview: true
    });}
    else {
      await ctx.replyWithHTML("Вы не являетесь лидом ни одного проекта. Выберите проекты через команду /new, либо /top")
      await ctx.scene.leave();
    }
  }

  @Hears(["Закончить просмотр"])
  @Action("action_leave")
  async onSceneLeave(@Ctx() ctx: Context) {
    try {
      ctx.session['edit_note'] = undefined
      await ctx.deleteMessage(ctx.callbackQuery.message.message_id)
    } catch {}
    
    await UserController.goToMainMenu(ctx)
  }

  @On('message')
  async onMessage(@Ctx() ctx: Context) {
    const user = await UserService.findById(ctx.from.id.toString())
    // console.log(ctx.session['edit_note'])
    if (ctx.session['edit_note']?.status) {
      let project = await prisma.project.findUnique({
        where: {
          id: ctx.session['edit_note'].project_id
        }
      })
      if (project.leadId != user.id) {
        await ctx.replyWithHTML(`Вы уже не занимаетесь проектом https://twitter.com/${project.name}`, {disable_web_page_preview: true})
        ctx.session['edit_note'] = undefined
        return
      }
      await prisma.project.update({
        data: {
          notes: {'text': ctx.message['text']}
        },
        where: {
          id: ctx.session['edit_note'].project_id
        }
      })
      project = await prisma.project.findUnique({
        where: {
          id: ctx.session['edit_note'].project_id
        }
      })
      const data_leave = { user:user.id, project: ctx.session['edit_note'].project_id, name: 'action_leave_project' };
      const data_change = { user:user.id, project: ctx.session['edit_note'].project_id, name: 'action_change_notes' };
      const data_tss = { user:user.id, project: ctx.session['edit_note'].project_id, name: 'action_get_tss' };
      await ctx.telegram.editMessageText(ctx.session['edit_note'].chat_id, ctx.session['edit_note'].message_id, ctx.session['edit_note'].inline_message_id, `Вы выбрали https://twitter.com/${project.name}${project.notes?`\n\nЗаметки:\n${project.notes['text']}`:''}`, {
        reply_markup: {
          inline_keyboard: [
              [ 
                { text: "Выйти из проекта", callback_data: JSON.stringify(data_leave) },  
                { text: "Изменить заметку", callback_data: JSON.stringify(data_change) },
                { text: "Запросить tss", callback_data: JSON.stringify(data_tss) },
              ]
          ]
        },
        disable_web_page_preview: true
      })
      ctx.session['edit_note'] = undefined
    }

  }
}

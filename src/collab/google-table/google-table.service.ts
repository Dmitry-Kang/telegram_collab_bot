import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { format } from "util";
import { Injectable } from '@nestjs/common';
import prisma from "../../common/prisma";
import axios from 'axios';
import * as fs from 'fs';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

@Injectable()
export class GoogleTableService {
  constructor() {
    let isRunning = false;
    const table1 = new GoogleSpreadsheet(process.env.GOOGLE_TABLE_USERS);
    const table2 = new GoogleSpreadsheet(process.env.GOOGLE_TABLE_PROJECTS);
    const config = JSON.parse(fs.readFileSync(`${process.env.GOOGLE_BOT_JSON}`, 'utf-8'));
    let sheet1, sheet2
    (async function() {
      await table1.useServiceAccountAuth({
        client_email: config.client_email,
        private_key: config.private_key,
      });
      await table1.loadInfo();
      await table2.useServiceAccountAuth({
        client_email: config.client_email,
        private_key: config.private_key,
      });
      await table2.loadInfo();
      console.log(table1.title);
      console.log(table2.title);

      sheet1 = table1.sheetsByIndex[0];
      sheet2 = table2.sheetsByIndex[0];
    }());

    setInterval(async () => {
      if (!isRunning) {
        try {
          isRunning = true
          console.log('google table start');
          await this.updateGoogle1(sheet1)
          await this.updateGoogle2(sheet2)
        } catch(e) {
          console.log("google table error", e)
        } finally {
          console.log("google table finish")
          isRunning = false
        }
      } else {
        // console.log('занято');
      }
      
    }, 10 * 60000);

  }

  // Users

  async updateGoogle1(sheet) {
    const users = await this.getAllUsers()
    const toadd =[]
    users.forEach(user => {
      toadd.push([user.telegramId, user.telegramName, user.role, user.projects.length ,user.leadingProjects.length, user.leadHistoryLength, user.likes, user.dislikes, user.totalVote])
    })

    let success = false
    do {
      try {
        await delay(60 * 1000)
        await this.addRow1(sheet, toadd)
        success = true
        console.log("google table1 success")
      } catch(e) {
        console.log("google table1 err1", e)
      }
    }
    while (!success)

    
  }

  async addRow1(sheet: GoogleSpreadsheetWorksheet, toadd) { 
    await sheet.clear("A:F")
    await sheet.setHeaderRow(['telegram Id', 'telegram name', 'Роль', 'Добавил проектов', 'Текущее кол-во лидов', 'Кол-во лидов за 2 недели', 'Likes', 'Dislikes', 'Total vote'])
    await sheet.addRows(toadd);
  }

  async getAllUsers() {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          {
            role: "ADMIN"
          },
          {
            role: "MANAGER"
          }
        ]
        
      },
      include: {
        leadingProjects: true,
        projects: true,
        votes: true,
        leadHistory: {
          where: {
            createdAt: {
              gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
            }
          }
        }
      }
    });

    const usersWithLeadHistory = users.map(user => {
      const leadHistory = user.leadHistory.reduce((sum, lead) => {
        return sum.add(lead.projectId)
      }, new Set())
      const totalVote = user.votes.reduce((sum, vote) => {
        return sum + (vote.vote ? 1 : -1)
      }, 0)
      const likes = user.votes.reduce((sum, vote) => {
        return sum + (vote.vote ? 1 : 0)
      }, 0)
      const dislikes = user.votes.reduce((sum, vote) => {
        return sum + (vote.vote ? 0 : 1)
      }, 0)
      
      return {
        ...user,
        leadHistoryLength: Array.from(leadHistory).length,
        totalVote,
        likes,
        dislikes
      }
    })

    return usersWithLeadHistory
  }

  // Projects

  async updateGoogle2(sheet) {
    const users = await this.getAllProjects()
    const toadd =[]
    users.forEach(project => {
      toadd.push([`https://twitter.com/${project.name}`, project.author.telegramName, project.tssScore, project.lead?.telegramName??null, project.likes, project.dislikes, project.totalVote])
    })
    let success = false
    do {
      try {
        await delay(60 * 1000)
        await this.addRow2(sheet, toadd)
        success = true
        console.log("google table2 success")
      } catch(e) {
        console.log("google table2 err2", e)
      }
    }
    while (!success)
    
  }

  async addRow2(sheet: GoogleSpreadsheetWorksheet, toadd) { 
    await sheet.clear("A:E")
    await sheet.setHeaderRow(['Name', 'Author', 'TSS', 'Lead', 'Likes', 'Dislikes', 'Total vote'])
    await sheet.addRows(toadd);
  }

  async getAllProjects() {
    let projects = await prisma.project.findMany({
      where: {
        tssScore: {
          gt: -1
        }
      },
      include: {
        votes: true,
        author: true,
        lead: true
      },
      orderBy: {

      }
    });

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

    const sortedProjects = projectsWithTotalVote.sort((a, b) => {
      if (a.totalVote === b.totalVote) {
        return b.tssScore - a.tssScore
      }
      return b.totalVote - a.totalVote
    })

    return sortedProjects
  }
}
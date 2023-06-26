import { Command, Ctx, Hears, Start, Update, Sender, TelegrafContextType, Help } from "nestjs-telegraf";
import { Context } from "../../interfaces/context.interface";
import { UserRoles } from "@prisma/client";
import { format } from "util";
import { Injectable } from '@nestjs/common';
import prisma from "../../common/prisma";
import axios from 'axios';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

class AsyncLock {
  disable: () => void;
  promise: Promise<void>;
  constructor () {
    this.disable = () => {}
    this.promise = Promise.resolve()
  }

  enable () {
    this.promise = new Promise(resolve => this.disable = resolve)
  }
}

@Injectable()
export class ShedulerService {
  constructor() {
    let isRunning = false;
    const lock = new AsyncLock()

    setInterval(async () => {
        if (!isRunning) {
          try {
            isRunning = true
            await lock.promise
            lock.enable()
            console.log('sheduler start');
            // const projects = await this.getAllProjects() // определенные
            const projects = await this.getSuperAllProjects() // все
            await projects.reduce(async (memo, el) => { // черепаха
              await memo
              el.tssScore = parseInt(await this.getPostTitles(el.name)) 
              el.tssRequestedAt = new Date() 
              await this.updateProject(el)
            }, Promise.resolve());
            // await Promise.all(projects.map(async (el) => { // дудос
            //   el.tssScore = parseInt(await this.getPostTitles(el.name)) 
            //   el.tssRequestedAt = new Date() 
            //   await this.updateProject(el)
            // }))
          }
          catch(e) {
            console.log("sheduler error", e)
          } finally {
            console.log("sheduler finish")
            lock.disable()
            isRunning = false
          }
        }
        
    }, 60 * 1000);

    // setInterval(async () => {
    //     await lock.promise
    //     lock.enable()
    //     console.log('свободно2');
    //     const projects = await this.getSuperAllProjects()
    //     await projects.reduce(async (memo, el) => {
    //       await memo
    //       el.tssScore = parseInt(await this.getPostTitles(el.name)) 
    //       el.tssRequestedAt = new Date() 

    //       await this.updateProject(el)

    //     }, Promise.resolve());
    //     console.log("finish2")
    //     lock.disable()
    // }, 24 * 60 * 60 * 1000);
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
          console.log(`sheduler success ${twitter}: tss ${res}`)
        } else {
          tries++
          console.log(`sheduler err1 ${twitter}`, response.status)
        }
      }).catch(e => {
        if (e?.response?.data?.detail && e.response.data.detail == "Account not found") {
          res = "-3"
          finish = true
          console.log(`sheduler not found ${twitter}: tss ${res}`)
        } else {
          tries++
          console.log(`sheduler err2 ${twitter}`, e.response.status)
        }
      });
    } catch (error) {
      tries++
      console.log(`sheduler err3 ${twitter}`, error)
    }
  } while (!finish || tries > 10)
  return res
}

  async getSuperAllProjects() {
    return prisma.project.findMany({
    });
  }

  async getAllProjects() {
    return prisma.project.findMany({
      where: {
        OR: [
          {
            tssScore: null
          },
          {
            tssScore: {
              gte: -2,
              lte: 0
            }
          }
        ]
        
      }
    });
  }

  async updateProject(el) {
    if (!el.notes) {
      el.notes = undefined
    }
    return prisma.project.update({
      where: {
        id: el.id,
      },
      data: el
    });
  }
}
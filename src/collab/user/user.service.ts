import { Command, Ctx, Hears, Start, Update, Sender, TelegrafContextType, Help } from "nestjs-telegraf";
import { UpdateType as TelegrafUpdateType } from "telegraf/typings/telegram-types";
import { UpdateType } from "../../common/decorators/update-type.decorator";
// import { PrismaService } from "../../prisma/prisma.service";
// import { MessageService } from "../../message/message.service";
import prisma from "../../common/prisma"
import { User } from "@prisma/client";
import { Injectable } from '@nestjs/common';
import { UserRoles } from "@prisma/client";
// const service = new MessageService()



@Injectable()
export class UserService {
  static async findAll(): Promise<User[]> {
    return prisma.user.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  static async getAdmins(): Promise<User[]> {
    return prisma.user.findMany({
      where: { role: UserRoles.ADMIN},
    });
  }

  static async findById(id): Promise<User> {
    return prisma.user.findUnique({
      where: {
        telegramId: id,
      },
    });
  }

  static async updateUser(data): Promise<void> {
    console.log(data)
  }
}

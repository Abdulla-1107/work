import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { OtpService } from 'src/otp/otp.service';
import { CreateUserDto } from './dto/register-user.dto';
import { JwtService } from '@nestjs/jwt';
import { LoginUserDto } from './dto/login-user.dto';
import * as bcrypt from 'bcrypt';
import { contains } from 'class-validator';
import { UserQueryDto } from './dto/query-user.dto';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otpService: OtpService,
    private readonly jwt: JwtService,
  ) {}

  removeNullValues(obj: any): { [k: string]: unknown } {
    return Object.fromEntries(
      Object.entries(obj).filter(([_, value]) => value !== null),
    );
  }

  async findAll(query: UserQueryDto) {
    const {
      page = '1',
      limit = '10',
      search,
      role,
      createdAtFrom,
      createdAtTo,
    } = query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where: any = {};

    if (search) {
      where.fullName = {
        contains: search,
        mode: 'insensitive',
      };
    }

    if (role) {
      where.role = role;
    }

    if (createdAtFrom || createdAtTo) {
      where.createdAt = {};
      if (createdAtFrom) {
        where.createdAt.gte = new Date(createdAtFrom);
      }
      if (createdAtTo) {
        where.createdAt.lte = new Date(createdAtTo);
      }
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      total,
      page: Number(page),
      limit: take,
      totalPages: Math.ceil(total / take),
    };
  }

  async requestOtp(phone: string) {
    const existingUser = await this.prisma.user.findFirst({
      where: { phone },
    });
    if (existingUser) {
      throw new BadRequestException(
        'Bu telefon raqami allaqachon ro‘yxatdan o‘tgan',
      );
    }
    return this.otpService.sendOtp(phone);
  }

  async verifyOtp(phone: string, code: string) {
    return this.otpService.verifyOtp(phone, code);
  }

  async register(dto: CreateUserDto) {
    // const isVerified = await this.otpService.isPhoneVerified(dto.phone);
    // if (!isVerified) {
    //   throw new BadRequestException('Telefon raqami OTP bilan tasdiqlanmagan');
    // }

    const registerUser = await this.prisma.user.create({
      data: { ...dto },
    });
    return { data: registerUser };
  }

  async login(dto: LoginUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });
    if (!user) {
      throw new NotFoundException('user topilmadi');
    }
    const token = this.jwt.sign({ id: user.id, phone: user.phone });
    return { token };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findFirst({ where: { id } });
    if (!user) {
      throw new NotFoundException('user topilmadi');
    }
    return { data: user };
  }

  async remove(id: string) {
    const user = await this.prisma.user.findFirst({ where: { id } });
    if (!user) {
      throw new NotFoundException('user topilmadi');
    }
    const deleteUser = await this.prisma.user.delete({ where: { id } });
    return { data: deleteUser };
  }

  async me(id: string) {
    console.log(id);
    const user = await this.prisma.user.findFirst({
      where: { id },
      include: { announcements: true },
    });
    console.log(user);
    if (!user) {
      throw new NotFoundException('user topilmadi');
    }
    return { data: user };
  }
}

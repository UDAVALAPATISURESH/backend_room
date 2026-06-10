import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ScopesGuard } from '../guards/scopes.guard';
import { RequireScopes } from '../decorators/scopes.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, ScopesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @RequireScopes('members.view', 'members.manage')
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @RequireScopes('members.view', 'members.manage')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @RequireScopes('members.manage')
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Put(':id')
  @RequireScopes('members.manage')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @RequireScopes('members.manage')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}

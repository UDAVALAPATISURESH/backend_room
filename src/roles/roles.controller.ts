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
import { RolesService } from './roles.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ScopesGuard } from '../guards/scopes.guard';
import { RequireScopes } from '../decorators/scopes.decorator';

@Controller('roles')
@UseGuards(JwtAuthGuard, ScopesGuard)
export class RolesController {
  constructor(private rolesService: RolesService) {}

  @Get('scopes')
  @RequireScopes('roles.view', 'roles.manage')
  findAllScopes() {
    return this.rolesService.findAllScopes();
  }

  @Get()
  @RequireScopes('roles.view', 'roles.manage')
  findAll() {
    return this.rolesService.findAllRoles();
  }

  @Get(':id')
  @RequireScopes('roles.view', 'roles.manage')
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  @Post()
  @RequireScopes('roles.manage')
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Put(':id')
  @RequireScopes('roles.manage')
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(id, dto);
  }

  @Delete(':id')
  @RequireScopes('roles.manage')
  remove(@Param('id') id: string) {
    return this.rolesService.remove(id);
  }
}

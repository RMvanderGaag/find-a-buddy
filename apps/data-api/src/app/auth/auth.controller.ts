import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { IdentityDTO } from './identity.dto';

@Controller('auth-api')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('register')
    async register(@Body() identityDTO: IdentityDTO) {
        await this.authService.registerUser(identityDTO.username, identityDTO.password);
    }

    @Post('login')
    async login(@Body() identityDTO: IdentityDTO): Promise<string> {
        return await this.authService.generateToken(identityDTO.username, identityDTO.password);
    }
}
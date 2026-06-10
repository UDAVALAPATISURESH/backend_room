import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class LoginDto {
  @IsString()
  @Matches(/^[0-9]{10}$/, { message: 'Mobile must be 10 digits' })
  mobile: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

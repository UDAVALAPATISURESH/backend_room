import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class LoginDto {
  @IsString()
  @Matches(/^[0-9]{10}$/, { message: 'Enter a valid 10-digit mobile number' })
  mobile: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

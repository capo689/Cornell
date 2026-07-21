import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReportDamageDto {
  @IsIn(['good', 'attention', 'repair'])
  condition!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

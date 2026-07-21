import { IsUUID } from 'class-validator';

export class AssignSubstituteDto {
  @IsUUID()
  memberId!: string;
}

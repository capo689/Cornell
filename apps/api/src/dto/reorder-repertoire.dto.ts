import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class ReorderRepertoireDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  itemIds!: string[];
}

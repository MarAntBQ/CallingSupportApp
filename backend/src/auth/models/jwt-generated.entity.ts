import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('jwt_generated')
export class JwtGenerated {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text')
  payload: string;

  @Column('text')
  token: string;

  @Column({ default: true })
  active: boolean;

  @Column('datetime')
  expiration: Date;
}

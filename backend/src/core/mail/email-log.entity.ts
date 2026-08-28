import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('email_log')
export class EmailLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  source: string;

  @Column()
  emailTo: string;

  @Column()
  emailSubject: string;

  @Column({ default: false })
  success: boolean;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn()
  createdAt: Date;
}

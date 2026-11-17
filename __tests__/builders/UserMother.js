import { User } from '../../src/domain/User.js';

// Object Mother: usuários simples e fixos, que raramente mudam entre os testes.
export class UserMother {
    static umUsuarioPadrao() {
        return new User(1, 'João Padrão', 'padrao@email.com', 'PADRAO');
    }

    static umUsuarioPremium() {
        return new User(2, 'Maria Premium', 'premium@email.com', 'PREMIUM');
    }
}

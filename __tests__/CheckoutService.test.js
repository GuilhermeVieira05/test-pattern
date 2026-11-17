import { CheckoutService } from '../src/services/CheckoutService.js';
import { Item } from '../src/domain/Item.js';
import { UserMother } from './builders/UserMother.js';
import { CarrinhoBuilder } from './builders/CarrinhoBuilder.js';

describe('CheckoutService', () => {
    const cartao = '4111-1111-1111-1111';

    // Dummies: só preenchem parâmetros; não devem ser chamados.
    const repositoryDummy = () => ({ salvar: jest.fn() });
    const emailDummy = () => ({ enviarEmail: jest.fn() });

    describe('quando o pagamento falha', () => {
        let gatewayStub, repositoryDummyObj, emailDummyObj, checkoutService, carrinho;

        beforeEach(() => {
            // Arrange
            carrinho = new CarrinhoBuilder().build();
            gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: false }) };
            repositoryDummyObj = repositoryDummy();
            emailDummyObj = emailDummy();
            checkoutService = new CheckoutService(gatewayStub, repositoryDummyObj, emailDummyObj);
        });

        it('deve retornar null (verificação de estado)', async () => {
            // Act
            const pedido = await checkoutService.processarPedido(carrinho, cartao);

            // Assert
            expect(pedido).toBeNull();
        });

        it('não deve salvar o pedido nem enviar e-mail', async () => {
            // Act
            await checkoutService.processarPedido(carrinho, cartao);

            // Assert
            expect(repositoryDummyObj.salvar).not.toHaveBeenCalled();
            expect(emailDummyObj.enviarEmail).not.toHaveBeenCalled();
        });
    });

    describe('quando um cliente padrão finaliza a compra', () => {
        it('deve retornar o pedido salvo com o totalFinal sem desconto (verificação de estado)', async () => {
            // Arrange
            const carrinho = new CarrinhoBuilder()
                .comUser(UserMother.umUsuarioPadrao())
                .comItens([new Item('Teclado', 150), new Item('Mouse', 50)])
                .build();
            const gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: true }) };
            const repositoryStub = {
                salvar: jest.fn().mockImplementation(async (pedido) => ({ ...pedido, id: 123 })),
            };
            const checkoutService = new CheckoutService(gatewayStub, repositoryStub, emailDummy());

            // Act
            const pedido = await checkoutService.processarPedido(carrinho, cartao);

            // Assert
            expect(pedido.id).toBe(123);
            expect(pedido.totalFinal).toBe(200);
            expect(pedido.status).toBe('PROCESSADO');
        });
    });

    describe('quando um cliente Premium finaliza a compra', () => {
        let gatewayStub, repositoryStub, emailMock, checkoutService, carrinho;

        beforeEach(() => {
            // Arrange
            const premium = UserMother.umUsuarioPremium();
            carrinho = new CarrinhoBuilder()
                .comUser(premium)
                .comItens([new Item('Monitor', 200)])
                .build();
            gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: true }) };
            repositoryStub = { salvar: jest.fn().mockResolvedValue({ id: 1 }) };
            emailMock = { enviarEmail: jest.fn().mockResolvedValue(undefined) };
            checkoutService = new CheckoutService(gatewayStub, repositoryStub, emailMock);
        });

        it('deve cobrar o valor com 10% de desconto (verificação de comportamento)', async () => {
            // Act
            await checkoutService.processarPedido(carrinho, cartao);

            // Assert
            expect(gatewayStub.cobrar).toHaveBeenCalledWith(180, cartao);
        });

        it('deve enviar o e-mail de aprovação uma vez com os dados corretos (verificação de comportamento)', async () => {
            // Act
            await checkoutService.processarPedido(carrinho, cartao);

            // Assert
            expect(emailMock.enviarEmail).toHaveBeenCalledTimes(1);
            expect(emailMock.enviarEmail).toHaveBeenCalledWith(
                'premium@email.com',
                'Seu Pedido foi Aprovado!',
                expect.any(String)
            );
        });
    });

    describe('quando o envio de e-mail falha', () => {
        it('não deve falhar o checkout', async () => {
            // Arrange
            const carrinho = new CarrinhoBuilder().build();
            const gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: true }) };
            const repositoryStub = { salvar: jest.fn().mockResolvedValue({ id: 9 }) };
            const emailStub = { enviarEmail: jest.fn().mockRejectedValue(new Error('SMTP fora do ar')) };
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const checkoutService = new CheckoutService(gatewayStub, repositoryStub, emailStub);

            // Act
            const pedido = await checkoutService.processarPedido(carrinho, cartao);

            // Assert
            expect(pedido).toEqual({ id: 9 });
            spy.mockRestore();
        });
    });
});

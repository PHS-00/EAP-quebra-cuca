/**
 * Gerenciador de armazenamento local para a EAP
 */
const EAPStorage = {
    STORAGE_KEY: 'quebra_cuca_eap_selecionada',

    /**
     * Salva a EAP escolhida ou enviada no Storage para uso no Dashboard
     * @param {Object} eapData - Objeto EAP completo
     */
    salvarEAP: function (eapData) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(eapData));
            return true;
        } catch (error) {
            console.error('Erro ao salvar EAP no localStorage:', error);
            return false;
        }
    },

    /**
     * Recupera a EAP selecionada
     * @returns {Object|null}
     */
    obterEAP: function () {
        const data = localStorage.getItem(this.STORAGE_KEY);
        return data ? JSON.parse(data) : null;
    },

    /**
     * Limpa a EAP ativa do Storage
     */
    limparEAP: function () {
        localStorage.removeItem(this.STORAGE_KEY);
    }
};
package com.kravia.companyos.legal;

import com.kravia.companyos.legal.LegalDto.ContractRequest;
import com.kravia.companyos.legal.LegalDto.ContractResponse;
import com.kravia.companyos.legal.LegalDto.LegalApprovalRequest;
import com.kravia.companyos.legal.LegalDto.LegalApprovalResponse;
import com.kravia.companyos.legal.LegalDto.LegalNoticeRequest;
import com.kravia.companyos.legal.LegalDto.LegalNoticeResponse;
import com.kravia.companyos.legal.LegalDto.LegalReportResponse;
import com.kravia.companyos.legal.LegalDto.LegalRiskRequest;
import com.kravia.companyos.legal.LegalDto.LegalRiskResponse;
import com.kravia.companyos.legal.LegalDto.LegalSummaryResponse;
import com.kravia.companyos.legal.LegalDto.ObligationRequest;
import com.kravia.companyos.legal.LegalDto.ObligationResponse;
import com.kravia.companyos.legal.LegalEnums.ContractType;
import com.kravia.companyos.legal.LegalEnums.LegalPriority;
import com.kravia.companyos.legal.LegalEnums.LegalReportType;
import com.kravia.companyos.legal.LegalEnums.LegalRiskSeverity;
import com.kravia.companyos.legal.LegalEnums.LegalStatus;
import com.kravia.companyos.user.AppUser;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/legal")
public class LegalController {
    private final LegalService service;

    public LegalController(LegalService service) {
        this.service = service;
    }

    @GetMapping("/summary")
    public LegalSummaryResponse summary(@AuthenticationPrincipal AppUser actor) {
        return service.summary(actor);
    }

    @GetMapping("/contracts")
    public List<ContractResponse> contracts(@RequestParam(required = false) String query, @RequestParam(required = false) ContractType type, @RequestParam(required = false) LegalStatus status, @AuthenticationPrincipal AppUser actor) {
        return service.contracts(query, type, status, actor);
    }

    @PostMapping("/contracts")
    public ContractResponse createContract(@RequestBody ContractRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.saveContract(null, request, actor);
    }

    @PutMapping("/contracts/{id}")
    public ContractResponse updateContract(@PathVariable UUID id, @RequestBody ContractRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.saveContract(id, request, actor);
    }

    @DeleteMapping("/contracts/{id}")
    public void archiveContract(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archiveContract(id, actor);
    }

    @GetMapping("/obligations")
    public List<ObligationResponse> obligations(@RequestParam(required = false) String query, @RequestParam(required = false) LegalStatus status, @RequestParam(required = false) LegalPriority priority, @AuthenticationPrincipal AppUser actor) {
        return service.obligations(query, status, priority, actor);
    }

    @PostMapping("/obligations")
    public ObligationResponse createObligation(@RequestBody ObligationRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.saveObligation(null, request, actor);
    }

    @PutMapping("/obligations/{id}")
    public ObligationResponse updateObligation(@PathVariable UUID id, @RequestBody ObligationRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.saveObligation(id, request, actor);
    }

    @DeleteMapping("/obligations/{id}")
    public void archiveObligation(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archive(id, "obligation", actor);
    }

    @GetMapping("/approvals")
    public List<LegalApprovalResponse> approvals(@RequestParam(required = false) String query, @RequestParam(required = false) LegalStatus status, @AuthenticationPrincipal AppUser actor) {
        return service.approvals(query, status, actor);
    }

    @PostMapping("/approvals")
    public LegalApprovalResponse createApproval(@RequestBody LegalApprovalRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.saveApproval(null, request, actor);
    }

    @PutMapping("/approvals/{id}")
    public LegalApprovalResponse updateApproval(@PathVariable UUID id, @RequestBody LegalApprovalRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.saveApproval(id, request, actor);
    }

    @DeleteMapping("/approvals/{id}")
    public void archiveApproval(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archive(id, "approval", actor);
    }

    @GetMapping("/notices")
    public List<LegalNoticeResponse> notices(@RequestParam(required = false) String query, @RequestParam(required = false) LegalStatus status, @AuthenticationPrincipal AppUser actor) {
        return service.notices(query, status, actor);
    }

    @PostMapping("/notices")
    public LegalNoticeResponse createNotice(@RequestBody LegalNoticeRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.saveNotice(null, request, actor);
    }

    @PutMapping("/notices/{id}")
    public LegalNoticeResponse updateNotice(@PathVariable UUID id, @RequestBody LegalNoticeRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.saveNotice(id, request, actor);
    }

    @DeleteMapping("/notices/{id}")
    public void archiveNotice(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archive(id, "notice", actor);
    }

    @GetMapping("/risks")
    public List<LegalRiskResponse> risks(@RequestParam(required = false) String query, @RequestParam(required = false) LegalRiskSeverity severity, @RequestParam(required = false) LegalStatus status, @AuthenticationPrincipal AppUser actor) {
        return service.risks(query, severity, status, actor);
    }

    @PostMapping("/risks")
    public LegalRiskResponse createRisk(@RequestBody LegalRiskRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.saveRisk(null, request, actor);
    }

    @PutMapping("/risks/{id}")
    public LegalRiskResponse updateRisk(@PathVariable UUID id, @RequestBody LegalRiskRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.saveRisk(id, request, actor);
    }

    @DeleteMapping("/risks/{id}")
    public void archiveRisk(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archive(id, "risk", actor);
    }

    @GetMapping("/reports")
    public LegalReportResponse report(@RequestParam(defaultValue = "CONTRACT_SUMMARY") LegalReportType type, @AuthenticationPrincipal AppUser actor) {
        return service.report(type, actor);
    }
}

package com.trazure.trazurebackend.controller;

import com.trazure.trazurebackend.entity.Footprint;
import com.trazure.trazurebackend.service.FootprintService; // 引用接口
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/footprints")
@CrossOrigin(origins = "http://localhost:5173", allowCredentials = "true")
public class FootprintController {

    @Autowired
    private FootprintService footprintService; // 注入接口

    @PostMapping("/light-up")
    public String saveFootprint(@RequestBody Footprint footprint) {
        footprintService.lightUp(footprint);
        return "success";
    }

    @GetMapping("/list")
    public List<Footprint> getAllFootprints() {
        return footprintService.getMyFootprints();
    }
}